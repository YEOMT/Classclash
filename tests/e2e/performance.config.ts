import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'visual-performance.spec.ts',timeout:540000,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:3000',trace:'off'},outputDir:'../../artifacts/performance-test-results'});
