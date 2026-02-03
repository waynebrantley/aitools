#!/usr/bin/env node

/**
 * Tests for verify-progress.mjs
 * Usage: node verify-progress.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert'
import { calculateProgress } from '../scripts/verify-progress.mjs'

test('calculateProgress - all files processed', () => {
  const initialFiles = ['file1.ts', 'file2.ts', 'file3.ts']
  const fixedFiles = new Set(['file1.ts', 'file2.ts', 'file3.ts'])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 3)
  assert.strictEqual(result.fixedCount, 3)
  assert.strictEqual(result.percentage, 100)
  assert.strictEqual(result.remaining.length, 0)
  assert.strictEqual(result.allProcessed, true)
})

test('calculateProgress - partial progress', () => {
  const initialFiles = ['file1.ts', 'file2.ts', 'file3.ts', 'file4.ts']
  const fixedFiles = new Set(['file1.ts', 'file2.ts'])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 4)
  assert.strictEqual(result.fixedCount, 2)
  assert.strictEqual(result.percentage, 50)
  assert.strictEqual(result.remaining.length, 2)
  assert.deepStrictEqual(result.remaining, ['file3.ts', 'file4.ts'])
  assert.strictEqual(result.allProcessed, false)
})

test('calculateProgress - no files processed', () => {
  const initialFiles = ['file1.ts', 'file2.ts', 'file3.ts']
  const fixedFiles = new Set([])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 3)
  assert.strictEqual(result.fixedCount, 0)
  assert.strictEqual(result.percentage, 0)
  assert.strictEqual(result.remaining.length, 3)
  assert.strictEqual(result.allProcessed, false)
})

test('calculateProgress - empty initial files', () => {
  const initialFiles = []
  const fixedFiles = new Set([])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 0)
  assert.strictEqual(result.fixedCount, 0)
  assert.strictEqual(result.percentage, 0)
  assert.strictEqual(result.remaining.length, 0)
  assert.strictEqual(result.allProcessed, true)
})

test('calculateProgress - more fixed than initial (edge case)', () => {
  const initialFiles = ['file1.ts', 'file2.ts']
  const fixedFiles = new Set(['file1.ts', 'file2.ts', 'file3.ts'])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 2)
  assert.strictEqual(result.fixedCount, 3)
  assert.strictEqual(result.percentage, 150)
  assert.strictEqual(result.remaining.length, 0)
  assert.strictEqual(result.allProcessed, true)
})

test('calculateProgress - correct percentage rounding', () => {
  const initialFiles = ['file1.ts', 'file2.ts', 'file3.ts']
  const fixedFiles = new Set(['file1.ts'])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.initialCount, 3)
  assert.strictEqual(result.fixedCount, 1)
  assert.strictEqual(result.percentage, 33) // 1/3 = 33.33 rounds to 33
  assert.strictEqual(result.remaining.length, 2)
  assert.strictEqual(result.allProcessed, false)
})

test('calculateProgress - identifies correct remaining files', () => {
  const initialFiles = ['fileA.ts', 'fileB.ts', 'fileC.ts', 'fileD.ts', 'fileE.ts']
  const fixedFiles = new Set(['fileB.ts', 'fileD.ts'])

  const result = calculateProgress(initialFiles, fixedFiles)

  assert.strictEqual(result.remaining.length, 3)
  assert.deepStrictEqual(result.remaining, ['fileA.ts', 'fileC.ts', 'fileE.ts'])
  assert.strictEqual(result.allProcessed, false)
})

console.log('✅ All verify-progress tests passed')
