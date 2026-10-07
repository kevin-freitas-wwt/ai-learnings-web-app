import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCategoryCounts, totalCount } from './computeStats.js'

const categories = ['Technology', 'Design Studio']

test( 'computeCategoryCounts counts entries per category, defaulting to 0', () => {
    const entries = [
        { category: 'Technology' },
        { category: 'Technology' },
        { category: 'Design Studio' },
    ]
    const counts = computeCategoryCounts( entries, categories )
    assert.deepEqual( counts, { Technology: 2, 'Design Studio': 1 } )
})

test( 'computeCategoryCounts buckets missing categories under Uncategorized', () => {
    const entries = [{ category: '' }, {}]
    const counts = computeCategoryCounts( entries, categories )
    assert.equal( counts.Uncategorized, 2 )
    assert.equal( counts.Technology, 0 )
    assert.equal( counts['Design Studio'], 0 )
})

test( 'counts always sum to the total number of entries', () => {
    const entries = [
        { category: 'Technology' },
        { category: 'Design Studio' },
        { category: 'Unknown Category' },
    ]
    const counts = computeCategoryCounts( entries, categories )
    const sum = Object.values( counts ).reduce( ( a, b ) => a + b, 0 )
    assert.equal( sum, totalCount( entries ) )
})

test( 'totalCount returns the entry count', () => {
    assert.equal( totalCount( [1, 2, 3] ), 3 )
    assert.equal( totalCount( [] ), 0 )
})
