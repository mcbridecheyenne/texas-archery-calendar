// Small wrapper over AsyncStorage. Every key is prefixed so the calendar's data
// stays separate when this module lives inside a bigger app.
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "archeryCalendar.";

export async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Storage is a convenience; never let it break the screen.
  }
}
