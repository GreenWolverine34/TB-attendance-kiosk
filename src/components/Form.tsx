import React, { useEffect, useState } from "react"; 
import { AdminCodeAction } from "../types"; 

interface FormProps { 
  isUnlocked: boolean; 
  isActive: boolean; 
  onAdminCode: (pin: string) => Promise<AdminCodeAction | null>; 
  onSuccess: (name: string) => void; 
} 

function isDigit(c: string) { 
  return c >= "0" && c <= "9"; 
} 

export default function Form({ isUnlocked, isActive, onAdminCode, onSuccess }: FormProps) { 
  const [value, setValue] = useState(""); 
  const [isLastInputFromNumpad, setIsLastInputFromNumpad] = useState(false); 
  const [lastShakeTime, setLastShakeTime] = useState(null); 
  const [isShaking, setIsShaking] = useState(false); 
  const [backspaceDownTime, setBackspaceDownTime] = useState(null); 
  const [activeButton, setActiveButton] = useState<string | null>(null); 
  const [validStudentIds, setValidStudentIds] = useState<string[]>([]);
  const [showUserNotFound, setShowUserNotFound] = useState(false);
  const [lastUserNotFoundTime, setLastUserNotFoundTime] = useState<Date | null>(null);
  
  function handleNumpadButtonClick(e: React.MouseEvent<HTMLButtonElement>) { 
    const digit = e.currentTarget.value; 
    const nextValue = value + digit;
    if (isUnlocked && validStudentIds.length > 0 && !isPrefixMatch(nextValue)) {
      triggerUserNotFound();
      return;
    }
    setValue(nextValue);
    setIsLastInputFromNumpad(true);
    setShowUserNotFound(false);
  } 

  function triggerUserNotFound() {
    setLastUserNotFoundTime(new Date());
  }

  function isPrefixMatch(candidate: string) {
    if (candidate.length === 0) {
      return true;
    }
    return validStudentIds.some((id) => id.startsWith(candidate));
  }

  function isKnownStudentTag(candidate: string) {
    return validStudentIds.includes(candidate);
  }

  function handleBackspaceDown(e: React.PointerEvent<HTMLButtonElement>) { 
    handleButtonActive(e); 
    setBackspaceDownTime(new Date()); 
  } 

  function handleBackspaceUp() { 
    handleButtonInactive(); 
    if (backspaceDownTime === null) { 
      return; 
    } 
    setValue(current => current.slice(0, -1)); 
    setBackspaceDownTime(null); 
  } 

  function handleBackspaceLeave() { 
    handleButtonInactive(); 
    setBackspaceDownTime(null); 
  } 

  function handleChangeFromKeyboardInput(e: React.ChangeEvent<HTMLInputElement>) { 
    const nextValue = e.target.value;
    if (isLastInputFromNumpad && (e.nativeEvent as InputEvent).inputType === "deleteContentBackward") {
      setValue("");
      setShowUserNotFound(false);
      return;
    }

    if (nextValue.length === 0) {
      setValue("");
      setShowUserNotFound(false);
      return;
    }

    if (!isDigit(nextValue[nextValue.length - 1])) {
      return;
    }

    if (isUnlocked && validStudentIds.length > 0 && !isPrefixMatch(nextValue)) {
      triggerUserNotFound();
      return;
    }

    if (isLastInputFromNumpad) {
      setValue(nextValue[nextValue.length - 1]);
    } else {
      setValue(nextValue);
    }
    setIsLastInputFromNumpad(false);
    setShowUserNotFound(false);
  } 

  async function handleSubmit(event: React.FormEvent) { 
    event.preventDefault(); 
    if (!isUnlocked) {
      const action = await onAdminCode(value);
      if (action === null) {
        setValue("");
        setLastShakeTime(new Date());
        return;
      }
      setValue("");
      return;
    }

    if (value.length !== 10 || (validStudentIds.length > 0 && !isKnownStudentTag(value))) {
      triggerUserNotFound();
      return;
    }
    
    const response = await window.electron.submit(value);
    if (!response.success) {
      triggerUserNotFound();
      return;
    }
    
    setValue("");
    setShowUserNotFound(false);
    
    // FIXED: Fall back to showing the input ID number string if the database name is empty
    const clientName = response.name || `ID #${value}`;
    onSuccess(clientName); 
  } 

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) { 
    if (isActive) { 
      e.target.focus(); 
    } 
  } 

  function handleButtonActive(e: React.PointerEvent<HTMLButtonElement>) { 
    setActiveButton(e.currentTarget.value); 
  } 

  function handleButtonInactive() { 
    if (activeButton === null) { 
      return; 
    } 
    setActiveButton(null); 
  } 

  useEffect(() => { 
    if (lastShakeTime === null) { 
      return; 
    } 
    setIsShaking(true); 
    const timeout = setTimeout(() => setIsShaking(false), 400); 
    return () => clearTimeout(timeout); 
  }, [lastShakeTime]); 

  useEffect(() => {
    if (backspaceDownTime === null) {
      return;
    }
    const timeout = setTimeout(() => setValue(""), 500);
    return () => clearTimeout(timeout);
  }, [backspaceDownTime]);

  useEffect(() => {
    if (lastUserNotFoundTime === null) {
      return;
    }
    setShowUserNotFound(true);
    const timeout = setTimeout(() => setShowUserNotFound(false), 1200);
    return () => clearTimeout(timeout);
  }, [lastUserNotFoundTime]);

  useEffect(() => {
    window.electron.getStudentIds().then(setValidStudentIds);
  }, []);

  return (
    <div> 
      <form onSubmit={handleSubmit}> 
        <input 
          type={isUnlocked ? "text" : "password"} 
          name="id-number" 
          className={"id-number-input" + (isShaking ? " shake" : "")} 
          value={value} 
          onChange={handleChangeFromKeyboardInput} 
          onBlur={handleBlur} 
          autoFocus 
          disabled={!isActive} 
        /> 
      </form> 

      <div className="numpad"> 
        {Array.from({length: 9}, (_, i) => ( 
          <button 
            key={i + 1} 
            value={i + 1} 
            className={activeButton === (i + 1).toString() ? "active" : ""} 
            onClick={handleNumpadButtonClick} 
            onPointerDown={handleButtonActive} 
            onPointerUp={handleButtonInactive} 
            onPointerLeave={handleButtonInactive} 
          > 
            {i + 1} 
          </button> 
        ))} 
        <button 
          value="backspace" 
          className={activeButton === "backspace" ? "active" : ""} 
          onPointerDown={handleBackspaceDown} 
          onPointerUp={handleBackspaceUp} 
          onPointerLeave={handleBackspaceLeave} 
        > 
          ⌫ 
        </button> 
        <button 
          value="0" 
          className={activeButton === "0" ? "active" : ""} 
          onClick={handleNumpadButtonClick} 
          onPointerDown={handleButtonActive} 
          onPointerUp={handleButtonInactive} 
          onPointerLeave={handleButtonInactive} 
        > 
          0 
        </button> 
        <button 
          value="submit" 
          className={activeButton === "submit" ? "active" : ""} 
          onClick={(e) => handleSubmit(e)} 
          onPointerDown={handleButtonActive} 
          onPointerUp={handleButtonInactive} 
          onPointerLeave={handleButtonInactive} 
        > 
          ⏎ 
        </button> 
      </div>

      {showUserNotFound && (
        <div className="user-not-found-message">User not Found.</div>
      )}
    </div> 
  ); 
}
