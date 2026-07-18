import assert from 'node:assert/strict';
import {
    mergeCampaignSave,
    mergeLevelProgress,
} from '../src/game/systems/campaign-progress.js';

function testMergeLevelBestTime() {
    const merged = mergeLevelProgress(
        { completed: true, bestTime: 40, medal: 'silver' },
        { completed: true, bestTime: 32, medal: 'bronze' },
    );
    assert.equal(merged.bestTime, 32);
    assert.equal(merged.medal, 'silver');
    assert.equal(merged.completed, true);
}

function testMergeLevelMedalUpgrade() {
    const merged = mergeLevelProgress(
        { completed: true, bestTime: 50, medal: 'bronze' },
        { completed: false, bestTime: 45, medal: 'gold' },
    );
    assert.equal(merged.medal, 'gold');
    assert.equal(merged.bestTime, 45);
    assert.equal(merged.completed, true);
}

function testMergeCampaignUnlocks() {
    const local = {
        version: 1,
        freePlay: false,
        unlockedChapters: ['tutorial'],
        unlockedMarbles: ['classic_red'],
        levels: {},
    };
    const remote = {
        version: 1,
        freePlay: true,
        unlockedChapters: ['tutorial', 'classic'],
        unlockedMarbles: ['classic_blue'],
        levels: {
            tutorial: { completed: true, bestTime: 30, medal: 'gold' },
        },
        revision: 2,
    };

    const merged = mergeCampaignSave(local, remote);
    assert.equal(merged.freePlay, true);
    assert.ok(merged.unlockedChapters.includes('classic'));
    assert.ok(merged.unlockedMarbles.includes('classic_blue'));
    assert.equal(merged.levels.tutorial.bestTime, 30);
    assert.equal(merged.revision, 2);
}

testMergeLevelBestTime();
testMergeLevelMedalUpgrade();
testMergeCampaignUnlocks();

console.log('All campaign merge tests passed.');
