import configurations from '@plugjs/eslint-plugin'

export default [
  ...configurations,

  // ===== DEFINE THE LOCATION OF OUR TSCONFIG.JSON FILES ======================
  {
    languageOptions: {
      parserOptions: {
        createDefaultProgram: false,
        project: [
          './tsconfig.json',
          './test/tsconfig.json',
        ],
      },
    },
  },

  // ===== ENSURE THAT OUR MAIN FILES DEPEND ONLY ON PROPER DEPENDENCIES =======
  {
    files: [ 'src/**' ],
    rules: {
      // Turn _ON_ dependencies checks only for sources
      'import-x/no-extraneous-dependencies': [ 'error', {
        'devDependencies': true,
        'peerDependencies': true,
        'optionalDependencies': true,
        'bundledDependencies': false,
      } ],
    },
  },

  // ===== PROJECT LOCAL RULES =================================================
  // Add any extra rule not tied to a specific "files" pattern here, e.g.:
  // {
  //   rules: {
  //     'camelcase': 'off',
  //   },
  // },

  // ===== IGNORED FILES =======================================================
  // REMEMBER! Ignores *must* be in its own configuration, they can not coexist
  // with "rules", "languageOptions", "files", ... or anything else, otherwise
  // ESLint will blaantly ignore the ignore files!
  {
    ignores: [
      'coverage/',
      'dist/',
      'node_modules/',
    ],
  },
]
