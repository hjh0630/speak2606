// Allow direct JSON imports that live OUTSIDE the workers project root
// (content/*.json and frontend/src/data/*.json). TypeScript's resolveJsonModule
// works fine for JSON inside the project, but these particular paths escape
// the workers/ subtree and TS module resolution gets confused.
//
// We declare the exact paths used so typecheck succeeds. Runtime bundling
// still works via wrangler esbuild.

declare module '../../../content/scenarios.json' {
  const value: import('./types').ScenarioMeta[];
  export default value;
}

declare module '../../../content/vocabulary.json' {
  const value: import('./types').VocabularyEntry[];
  export default value;
}

declare module '../../../content/system_prompts.json' {
  const value: Record<import('./types').Difficulty, string>;
  export default value;
}

declare module '../../../frontend/src/data/garment-textile-dict.json' {
  const value: Record<string, string[]>;
  export default value;
}
