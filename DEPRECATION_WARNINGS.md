# Known Deprecation Warnings and Resolution Timeline

This document tracks deprecated packages and planned resolution timeline for the Airtable Import project.

## Overview

The project currently has several deprecation warnings that appear during `npm install` and build processes. These warnings come from dependencies and indicate packages that will be removed or significantly changed in future versions.

## Critical Deprecation Warnings

### 🔴 HIGH PRIORITY (Security/Breaking Changes)

#### ESLint v8.57.1 → v9.x
- **Warning**: `eslint@8.57.1: This version is no longer supported`
- **Impact**: Security vulnerabilities, no updates
- **Blocker**: Requires react-scripts upgrade (breaking change)
- **Timeline**: Q1 2025 (requires major frontend refactoring)
- **Resolution**: Upgrade react-scripts to v6+ which includes ESLint v9 support

#### glob v7.2.3 → v9.x
- **Warning**: `glob@7.2.3: Glob versions prior to v9 are no longer supported`
- **Source**: Multiple sources (react-scripts, sqlite3/node-gyp)
- **Impact**: Security vulnerabilities, performance issues
- **Timeline**: Q1 2025 (bundled with react-scripts upgrade)
- **Workaround**: Backend Jest already uses glob@10.4.5

#### rimraf v3.0.2 → v4.x
- **Warning**: `rimraf@3.0.2: Rimraf versions prior to v4 are no longer supported`
- **Source**: sqlite3/node-gyp, react-scripts dependencies
- **Impact**: Potential security issues
- **Timeline**: Q1 2025 (bundled with dependency updates)

### 🟡 MEDIUM PRIORITY (Babel Plugins)

#### Babel Proposal Plugins → Transform Plugins
All `@babel/plugin-proposal-*` plugins have been merged into ECMAScript standard and should be replaced with `@babel/plugin-transform-*` equivalents:

1. **@babel/plugin-proposal-private-methods** → **@babel/plugin-transform-private-methods**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

2. **@babel/plugin-proposal-optional-chaining** → **@babel/plugin-transform-optional-chaining**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

3. **@babel/plugin-proposal-nullish-coalescing-operator** → **@babel/plugin-transform-nullish-coalescing-operator**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

4. **@babel/plugin-proposal-numeric-separator** → **@babel/plugin-transform-numeric-separator**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

5. **@babel/plugin-proposal-class-properties** → **@babel/plugin-transform-class-properties**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

6. **@babel/plugin-proposal-private-property-in-object** → **@babel/plugin-transform-private-property-in-object**
   - **Warning**: `This proposal has been merged to the ECMAScript standard`
   - **Source**: react-scripts babel configuration
   - **Timeline**: Q1 2025

### 🟠 MEDIUM PRIORITY (Build Tools)

#### rollup-plugin-terser → @rollup/plugin-terser
- **Warning**: `rollup-plugin-terser@7.0.2: This package has been deprecated and is no longer maintained`
- **Source**: react-scripts webpack configuration
- **Impact**: Build process maintenance issues
- **Timeline**: Q1 2025 (bundled with react-scripts upgrade)

#### @humanwhocodes/config-array → @eslint/config-array
- **Warning**: `@humanwhocodes/config-array@0.13.0: Use @eslint/config-array instead`
- **Source**: ESLint dependencies
- **Timeline**: Q1 2025 (bundled with ESLint v9 upgrade)

#### @humanwhocodes/object-schema → @eslint/object-schema
- **Warning**: `@humanwhocodes/object-schema@2.0.3: Use @eslint/object-schema instead`
- **Source**: ESLint dependencies
- **Timeline**: Q1 2025 (bundled with ESLint v9 upgrade)

#### sourcemap-codec → @jridgewell/sourcemap-codec
- **Warning**: `sourcemap-codec@1.4.8: Please use @jridgewell/sourcemap-codec instead`
- **Source**: Various build tools
- **Impact**: Source map generation issues
- **Timeline**: Q1 2025

### 🟢 LOW PRIORITY (Legacy Libraries)

#### inflight@1.0.6 → lru-cache
- **Warning**: `inflight@1.0.6: This module is not supported, and leaks memory`
- **Source**: sqlite3/node-gyp dependencies
- **Impact**: Memory leaks in development environment
- **Workaround**: Only affects development builds
- **Timeline**: Q2 2025

#### Native API Replacements
1. **abab@2.0.6** → Native `atob()` and `btoa()`
   - **Warning**: `Use your platform's native atob() and btoa() methods instead`
   - **Timeline**: Q2 2025

2. **domexception@2.0.1** → Native `DOMException`
   - **Warning**: `Use your platform's native DOMException instead`
   - **Timeline**: Q2 2025

3. **w3c-hr-time@1.0.2** → Native `performance.now()` and `performance.timeOrigin`
   - **Warning**: `Use your platform's native performance.now() and performance.timeOrigin`
   - **Timeline**: Q2 2025

#### Legacy Library Updates
1. **svgo@1.3.2** → v2.x.x or later
   - **Warning**: `This SVGO version is no longer supported. Upgrade to v2.x.x`
   - **Source**: react-scripts dependencies
   - **Timeline**: Q1 2025

2. **q@1.5.1** → Native Promises
   - **Warning**: `You or someone you depend on is using Q, the JavaScript Promise library...`
   - **Impact**: Legacy promise implementation
   - **Timeline**: Q2 2025

3. **stable@0.1.8** → Modern Array.sort()
   - **Warning**: `Modern JS already guarantees Array#sort() is a stable sort`
   - **Impact**: Unnecessary polyfill
   - **Timeline**: Q2 2025

#### Workbox (Service Workers)
1. **workbox-cacheable-response@6.6.0**
   - **Warning**: `workbox-background-sync@6.6.0`
   - **Source**: react-scripts PWA features
   - **Timeline**: Q2 2025

2. **workbox-google-analytics@6.6.0**
   - **Warning**: `It is not compatible with newer versions of GA starting with v4`
   - **Recommendation**: Remove if using Google Analytics v4+
   - **Timeline**: Q2 2025

## Resolution Strategy

### Phase 1: Critical Security Issues (Q1 2025)
**Target**: Address high-priority security and compatibility issues

1. **Major react-scripts upgrade** (v5.0.1 → v6.x or latest)
   - ✅ **Benefits**: Resolves ESLint, Babel, build tool deprecations
   - ⚠️ **Risks**: Breaking changes to build process
   - 📋 **Requirements**: 
     - Comprehensive testing of build process
     - Update CI/CD configuration
     - Validate all frontend functionality
     - Update documentation

2. **Frontend modernization**
   - Update TypeScript configuration
   - Resolve any breaking changes from react-scripts upgrade
   - Update test configurations
   - Validate browser compatibility

### Phase 2: Build Tool Modernization (Q1-Q2 2025)
**Target**: Update remaining build and development tools

1. **Babel configuration cleanup**
   - Migrate proposal plugins to transform plugins
   - Update build scripts and configurations
   - Test build output consistency

2. **ESLint v9 configuration**
   - Update ESLint rules and configurations
   - Resolve any linting rule conflicts
   - Update IDE configurations

### Phase 3: Legacy Library Cleanup (Q2 2025)
**Target**: Replace legacy libraries with modern alternatives

1. **Native API migration**
   - Replace polyfills with native browser APIs
   - Update browser compatibility requirements
   - Test across supported browsers

2. **Memory leak prevention**
   - Replace inflight with lru-cache
   - Update caching strategies
   - Performance testing

### Phase 4: Optional Improvements (Q2-Q3 2025)
**Target**: Non-critical optimizations

1. **Service Worker updates**
   - Evaluate PWA requirements
   - Update or remove Workbox dependencies
   - Optimize caching strategies

2. **Performance optimizations**
   - Bundle size analysis
   - Dead code elimination
   - Modern JavaScript features adoption

## Monitoring and Tracking

### Automated Checks
- **npm audit**: Regular security vulnerability scanning
- **Dependency updates**: Automated PR creation for safe updates
- **CI/CD integration**: Fail builds on high-severity vulnerabilities

### Manual Reviews
- **Quarterly dependency review**: Assess new deprecations
- **Annual architecture review**: Evaluate major version upgrades
- **Performance monitoring**: Track build times and bundle sizes

### Documentation Updates
- Update this document when deprecations are resolved
- Maintain changelog of major dependency changes
- Document breaking changes and migration guides

## Current Status Summary

| Category | Count | Status | Priority |
|----------|-------|--------|----------|
| Critical Security | 3 | Pending | 🔴 High |
| Babel Plugins | 6 | Pending | 🟡 Medium |
| Build Tools | 4 | Pending | 🟠 Medium |
| Legacy Libraries | 8 | Pending | 🟢 Low |
| **Total** | **21** | **Tracked** | **Mixed** |

### Resolution Progress
- ✅ **Backend dependencies**: pg, supertest updated to required versions
- ✅ **Database configuration**: Verified working correctly
- ✅ **Jest**: Updated to v30.1.3 (includes glob@10.4.5)
- 🔄 **Frontend security**: Pending react-scripts upgrade
- 📋 **Documentation**: This tracking document created

## Risk Assessment

### High Risk (Immediate Action Required)
- **ESLint v8**: Security vulnerabilities, no further updates
- **glob v7**: Security and performance issues
- **Frontend vulnerabilities**: 9 moderate-to-high severity issues

### Medium Risk (Action Required Q1 2025)
- **Babel deprecations**: Will break in future Node.js versions
- **Build tool deprecations**: Maintenance and compatibility issues

### Low Risk (Can be deferred)
- **Memory leaks**: Only affect development environment
- **Legacy polyfills**: Modern browsers don't need them
- **Service workers**: Only if PWA features are used

This document will be updated as deprecations are resolved and new ones are identified.