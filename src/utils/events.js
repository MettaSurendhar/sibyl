import { DeviceEventEmitter } from 'react-native';

export const DB_UPDATED_EVENT = 'db_updated';

export function emitDbUpdated() {
  DeviceEventEmitter.emit(DB_UPDATED_EVENT);
}
