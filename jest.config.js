module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/?(*.)+(test).[jt]s?(x)'],
  clearMocks: true,
  moduleNameMapper: {
    '^@react-native-async-storage/async-storage$':
      '<rootDir>/test/async-storage-mock.js',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
