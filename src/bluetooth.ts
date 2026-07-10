import { ChildProcessWithoutNullStreams, execFile, spawn } from "child_process";
import * as fs from "fs";
import { promisify } from "util";

import { BluetoothDevice } from "./types";

const execFileAsync = promisify(execFile);
const BLUETOOTH_ADDRESS = /^([0-9A-F]{2}:){5}[0-9A-F]{2}$/i;
const COMMAND_TIMEOUT_MS = 10_000;

let pairingSession: ChildProcessWithoutNullStreams | undefined;

function normalizeAddress(address: string) {
    const normalizedAddress = address.trim().toUpperCase();
    if (!BLUETOOTH_ADDRESS.test(normalizedAddress)) {
        throw new Error("Enter a valid Bluetooth device address");
    }
    return normalizedAddress;
}

function assertLinux() {
    if (process.platform !== "linux") {
        throw new Error("Bluetooth export is available on the Raspberry Pi only");
    }
}

async function runBluetoothctl(args: string[]) {
    assertLinux();
    const { stdout } = await execFileAsync("bluetoothctl", args, {
        encoding: "utf8",
        timeout: COMMAND_TIMEOUT_MS,
    });
    return stdout.toString();
}

async function ensureAdapterAvailable() {
    const output = await runBluetoothctl(["show"]);
    if (!/Controller\s+[0-9A-F]{2}:/i.test(output)) {
        throw new Error("No Bluetooth adapter was found on this Pi");
    }
}

function runPairingCommand(command: string) {
    if (!pairingSession || !pairingSession.stdin.writable) {
        throw new Error("Bluetooth pairing is not running");
    }
    pairingSession.stdin.write(`${command}\n`);
}

async function startPairingSession() {
    if (pairingSession && pairingSession.exitCode === null && !pairingSession.killed) {
        return;
    }

    pairingSession = await new Promise<ChildProcessWithoutNullStreams>((resolve, reject) => {
        const child = spawn("bluetoothctl", ["--agent", "NoInputNoOutput"], {
            stdio: ["pipe", "ignore", "pipe"],
        });

        child.once("error", reject);
        child.once("spawn", () => resolve(child));
        child.on("exit", () => {
            if (pairingSession === child) {
                pairingSession = undefined;
            }
        });
    });
}

export async function enableBluetoothExportDiscovery() {
    await ensureAdapterAvailable();
    await startPairingSession();
    runPairingCommand("power on");
    runPairingCommand("default-agent");
    runPairingCommand("pairable on");
    runPairingCommand("discoverable-timeout 0");
    runPairingCommand("discoverable on");
}

export async function disableBluetoothExportDiscovery() {
    if (!pairingSession) {
        return;
    }

    const activeSession = pairingSession;
    runPairingCommand("discoverable off");
    runPairingCommand("pairable off");
    pairingSession = undefined;

    await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
            activeSession.kill();
            resolve();
        }, 1_000);

        activeSession.once("exit", () => {
            clearTimeout(timeout);
            resolve();
        });
        activeSession.stdin.end("quit\n");
    });
}

export async function getPairedBluetoothDevices(): Promise<BluetoothDevice[]> {
    const output = await runBluetoothctl(["paired-devices"]);
    const devices: BluetoothDevice[] = [];

    for (const line of output.split("\n")) {
        const match = line.match(/^Device\s+(([0-9A-F]{2}:){5}[0-9A-F]{2})\s*(.*)$/i);
        if (!match) {
            continue;
        }

        const address = normalizeAddress(match[1]);
        devices.push({
            address,
            name: match[3].trim() || address,
        });
    }

    return devices.sort((a, b) => a.name.localeCompare(b.name));
}

function sanitizeTrustedDevices(value: unknown): BluetoothDevice[] {
    if (!Array.isArray(value)) {
        return [];
    }

    const devices = new Map<string, BluetoothDevice>();
    for (const device of value) {
        if (!device || typeof device !== "object") {
            continue;
        }
        const { address, name } = device as Partial<BluetoothDevice>;
        if (typeof address !== "string") {
            continue;
        }
        try {
            const normalizedAddress = normalizeAddress(address);
            devices.set(normalizedAddress, {
                address: normalizedAddress,
                name: typeof name === "string" && name.trim() ? name.trim() : normalizedAddress,
            });
        } catch {
            // Ignore malformed entries so one bad record does not block exports.
        }
    }

    return [...devices.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTrustedBluetoothDevices(configPath: string): Promise<BluetoothDevice[]> {
    try {
        const contents = await fs.promises.readFile(configPath, "utf8");
        return sanitizeTrustedDevices(JSON.parse(contents));
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            return [];
        }
        throw new Error("Could not read the trusted Bluetooth device list");
    }
}

async function saveTrustedBluetoothDevices(configPath: string, devices: BluetoothDevice[]) {
    await fs.promises.writeFile(configPath, `${JSON.stringify(devices, null, 2)}\n`, "utf8");
}

export async function trustBluetoothDevice(configPath: string, address: string): Promise<BluetoothDevice[]> {
    const normalizedAddress = normalizeAddress(address);
    const pairedDevices = await getPairedBluetoothDevices();
    const device = pairedDevices.find((pairedDevice) => pairedDevice.address === normalizedAddress);
    if (!device) {
        throw new Error("Pair the device with the kiosk before trusting it for exports");
    }

    await runBluetoothctl(["trust", normalizedAddress]);
    const devices = await getTrustedBluetoothDevices(configPath);
    const updatedDevices = sanitizeTrustedDevices([...devices, device]);
    await saveTrustedBluetoothDevices(configPath, updatedDevices);
    return updatedDevices;
}

export async function removeTrustedBluetoothDevice(configPath: string, address: string): Promise<BluetoothDevice[]> {
    const normalizedAddress = normalizeAddress(address);
    const devices = await getTrustedBluetoothDevices(configPath);
    const updatedDevices = devices.filter((device) => device.address !== normalizedAddress);
    await saveTrustedBluetoothDevices(configPath, updatedDevices);

    try {
        await runBluetoothctl(["untrust", normalizedAddress]);
    } catch (err) {
        console.log("Could not remove BlueZ trust for Bluetooth export device", err);
    }

    return updatedDevices;
}

export async function sendFileToBluetoothDevice(device: BluetoothDevice, filePath: string) {
    assertLinux();
    const address = normalizeAddress(device.address);
    await execFileAsync("bluetooth-sendto", [
        `--device=${address}`,
        `--name=${device.name}`,
        filePath,
    ], {
        encoding: "utf8",
        timeout: 5 * 60_000,
    });
}
