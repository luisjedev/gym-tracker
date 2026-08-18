module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  clearMocks: true,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/test/async-storage-mock.js',
    '^expo-file-system$': '<rootDir>/test/expo-file-system-mock.js',
    '^expo-image-picker$': '<rootDir>/test/expo-image-picker-mock.js',
    '^expo-notifications$': '<rootDir>/test/expo-notifications-mock.js',
    '^expo-video$': '<rootDir>/test/expo-video-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
