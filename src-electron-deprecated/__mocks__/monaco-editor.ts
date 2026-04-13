// Stub for monaco-editor in vitest environment.
// The real monaco-editor has non-standard ESM exports that Vite cannot resolve.
// Components that use @monaco-editor/react already mock that package in their tests.
export const editor = {
  defineTheme: () => {},
  setTheme: () => {},
  MouseTargetType: {},
}
export default {}
