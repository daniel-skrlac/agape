import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Keyboard } from "react-native";

type KeyboardInsetState = {
  bottom: number;
  visible: boolean;
};

const KeyboardInsetContext = createContext<KeyboardInsetState>({ bottom: 0, visible: false });

export function KeyboardInsetProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<KeyboardInsetState>({ bottom: 0, visible: false });

  useEffect(() => {
    const show = (event: any) => {
      const height = Number(event?.endCoordinates?.height ?? 0);
      setState({ bottom: Math.max(0, height), visible: height > 0 });
    };
    const hide = () => setState({ bottom: 0, visible: false });

    const willShow = Keyboard.addListener("keyboardWillShow", show);
    const didShow = Keyboard.addListener("keyboardDidShow", show);
    const willHide = Keyboard.addListener("keyboardWillHide", hide);
    const didHide = Keyboard.addListener("keyboardDidHide", hide);

    return () => {
      willShow.remove();
      didShow.remove();
      willHide.remove();
      didHide.remove();
    };
  }, []);

  const value = useMemo(() => state, [state]);

  return <KeyboardInsetContext.Provider value={value}>{children}</KeyboardInsetContext.Provider>;
}

export function useKeyboardInset() {
  return useContext(KeyboardInsetContext);
}
