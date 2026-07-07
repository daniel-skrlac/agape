import { RefObject, useCallback, useRef } from "react";
import { findNodeHandle, Platform, ScrollView, TextInput, UIManager } from "react-native";

export function useKeyboardAwareScroll(offset = 72) {
  const scrollRef = useRef<ScrollView>(null);

  const revealInput = useCallback(
    (inputRef: RefObject<TextInput | null>) => {
      const delay = Platform.OS === "android" ? 180 : 80;

      setTimeout(() => {
        const scrollNode = findNodeHandle(scrollRef.current);
        const inputNode = findNodeHandle(inputRef.current);
        if (!scrollNode || !inputNode) return;

        UIManager.measureLayout(
          inputNode,
          scrollNode,
          () => undefined,
          (_x, y) => {
            scrollRef.current?.scrollTo({
              y: Math.max(0, y - offset),
              animated: true,
            });
          },
        );
      }, delay);
    },
    [offset],
  );

  return { scrollRef, revealInput };
}
