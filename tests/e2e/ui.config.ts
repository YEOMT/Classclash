import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'ui.spec.ts',timeout:240000,workers:1,reporter:'list',use:{baseURL:'http://127.0.0.1:3000',viewport:{width:1366,height:768},trace:'off'},outputDir:'../../artifacts/ui-test-results'});

