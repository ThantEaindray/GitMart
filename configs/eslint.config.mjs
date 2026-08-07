import globals from 'globals';
import pluginJs from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  // ── Ignore patterns ────────────────────────────────────
  {
    ignores: [
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'coverage-report/**',
      'reports/**',
    ],
  },

  // ── Base: all JS files are CommonJS ────────────────────
  { files: ['**/*.js'], languageOptions: { sourceType: 'commonjs' } },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },

  // ── ESLint recommended rules ───────────────────────────
  // Enables core rules from @eslint/js including:
  //   constructor-super        – Require super() in constructors of derived classes
  //   for-direction            – Enforce correct direction in for-loops
  //   getter-return            – Require return in getters
  //   no-async-promise-executor – Disallow async functions passed to new Promise()
  //   no-class-assign          – Disallow reassigning class declarations
  //   no-compare-neg-zero      – Disallow comparing against -0
  //   no-cond-assign           – Disallow assignment in conditional expressions
  //   no-const-assign          – Disallow reassigning const variables
  //   no-constant-condition    – Disallow constant expressions in conditions
  //   no-control-regex         – Disallow control characters in regex
  //   no-debugger              – Disallow the use of debugger
  //   no-delete-var            – Disallow deleting variables
  //   no-dupe-args             – Disallow duplicate arguments in functions
  //   no-dupe-class-members    – Disallow duplicate class members
  //   no-dupe-else-if          – Disallow duplicate conditions in if-else chains
  //   no-dupe-keys             – Disallow duplicate keys in object literals
  //   no-duplicate-case        – Disallow duplicate case labels
  //   no-empty                 – Disallow empty block statements
  //   no-empty-character-class – Disallow empty character classes in regex
  //   no-empty-pattern         – Disallow empty destructuring patterns
  //   no-ex-assign             – Disallow reassigning exceptions in catch clauses
  //   no-extra-boolean-cast    – Disallow unnecessary boolean casts
  //   no-fallthrough           – Disallow case statement fallthrough
  //   no-func-assign           – Disallow reassigning function declarations
  //   no-global-assign         – Disallow assignment to native objects
  //   no-import-assign         – Disallow assigning to imported bindings
  //   no-inner-declarations    – Disallow function/var declarations in nested blocks
  //   no-invalid-regexp        – Disallow invalid regex constructors
  //   no-irregular-whitespace  – Disallow irregular whitespace
  //   no-loss-of-precision     – Disallow literal numbers that lose precision
  //   no-misleading-character-class – Disallow characters that behave unexpectedly in regex
  //   no-new-symbol            – Disallow new operators with the Symbol object
  //   no-nonoctal-decimal-escape – Disallow \8 and \9 escape sequences in strings
  //   no-obj-calls             – Disallow calling global objects as functions (Math(), JSON())
  //   no-octal                 – Disallow octal literals
  //   no-prototype-builtins    – Disallow calling Object.prototype methods directly on objects
  //   no-redeclare             – Disallow variable redeclaration
  //   no-regex-spaces          – Disallow multiple spaces in regex
  //   no-self-assign           – Disallow assignments where both sides are the same
  //   no-setter-return         – Disallow returning values from setters
  //   no-shadow-restricted-names – Disallow shadowing restricted names (undefined, NaN, etc.)
  //   no-sparse-arrays         – Disallow sparse arrays ([1,,3])
  //   no-this-before-super     – Disallow this/super before calling super() in constructors
  //   no-undef                 – Disallow use of undeclared variables
  //   no-unexpected-multiline  – Disallow confusing multiline expressions
  //   no-unreachable           – Disallow unreachable code after return/throw/break/continue
  //   no-unsafe-finally        – Disallow control flow in finally blocks
  //   no-unsafe-negation       – Disallow negating the left operand of relational operators
  //   no-unsafe-optional-chaining – Disallow optional chaining in contexts where undefined is not allowed
  //   no-unused-labels         – Disallow unused labels
  //   no-unused-vars           – Disallow unused variables
  //   no-useless-backreference – Disallow useless backreferences in regex
  //   no-useless-catch         – Disallow unnecessary catch clauses
  //   no-useless-escape        – Disallow unnecessary escape characters
  //   no-with                  – Disallow with statements
  //   require-yield            – Require generator functions to contain yield
  //   use-isnan                – Require calls to isNaN() when checking for NaN
  //   valid-typeof             – Enforce comparing typeof against valid strings
  pluginJs.configs.recommended,

  // ── Prettier: disable conflicting ESLint rules ─────────
  // Turns off ~330 formatting rules (indent, quotes, semi, spacing, etc.)
  // so Prettier alone handles code formatting without ESLint conflicts.
  prettierConfig,

  // ── Prettier as an ESLint rule ─────────────────────────
  {
    plugins: { prettier: prettierPlugin },
    rules: {
      'prettier/prettier': 'warn',
    },
  },

  // ── Test-file overrides ────────────────────────────────
  {
    files: ['__tests__/**/*.js', 'e2e-tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },

  // ── Global rule overrides ──────────────────────────────
  // Allow _-prefixed parameters to be unused (common Express/pg callback pattern)
  {
    rules: {
      'no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // ── Browser globals for public/js files ───────────────
  // These files are loaded via <script> tags — functions defined in one
  // file are available globally to others. ESLint can't see cross-file
  // usage, so declare shared globals here and downgrade no-unused-vars
  // to warn (browser script pattern makes it unavoidable).
  {
    files: ['public/**/*.js'],
    languageOptions: {
      globals: {
        gsap: 'readonly',
        ScrollTrigger: 'readonly',
        authFetch: 'writable',
        fetchMethod: 'writable',
        formatPrice: 'writable',
        sendTxt: 'writable',
        buildMessageElement: 'writable',
        CURRENCIES: 'writable',
        uId: 'writable',
        token: 'writable',
        getProductById: 'writable',
        getProductsByCategory: 'writable',
        showToast: 'writable',
        initReviews: 'writable',
        deleteReview: 'writable',
      },
    },
    rules: {
      'no-unused-vars': 'warn',
    },
  },
];
