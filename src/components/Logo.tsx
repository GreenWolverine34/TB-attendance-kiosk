import React from "react";
import terrorBytesLogo from "../../assets/TerrorBytesRoboticsLogo.png";

export default function Logo() {
    return <div className="terrorbytes-logo">
        <img
            className="terrorbytes-logo-image"
            src={terrorBytesLogo}
            alt="TerrorBytes Robotics"
            draggable={false}
        />
    </div>;
}
