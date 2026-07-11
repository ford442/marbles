import assert from 'node:assert/strict';
import { CampaignProgress, CAMPAIGN_STORAGE_KEY } from '../src/game/systems/campaign-progress.js';
import {
    buildChapterLayout,
    computeMedal,
    getChapterForLevel,
    getMedalThresholds,
} from '../src/levels/campaign.js';

function mockStorage() {
    /** @type {Record<string, string>} */
    const store = {};
    return {
        getItem: (k) => store[k] ?? null,
        setItem: (k, v) => { store[k] = v; },
    };
}

function testTutorialUnlocksClassic() {
    const storage = mockStorage();
    globalThis.localStorage = storage;

    const campaign = new CampaignProgress();
    campaign.setCatalog({
        tutorial: { name: 'Tutorial', difficulty: 'easy', goals: [{}] },
        landing: { name: 'Landing', difficulty: 'easy', goals: [{}] },
        jump: { name: 'Jump', difficulty: 'medium', goals: [{}] },
    });

    assert.equal(campaign.isChapterUnlocked('tutorial'), true);
    assert.equal(campaign.isChapterUnlocked('classic'), false);

    campaign.recordCompletion('tutorial', {
        time: 40,
        level: { difficulty: 'easy', medals: { goldTime: 25, silverTime: 45, bronzeTime: 90, parTime: 35 } },
    });

    assert.equal(campaign.isChapterUnlocked('classic'), true);
    assert.equal(campaign.getLevelProgress('tutorial')?.completed, true);
    assert.equal(campaign.getLevelProgress('tutorial')?.bestTime, 40);
}

function testBestTimePersists() {
    const storage = mockStorage();
    globalThis.localStorage = storage;

    const campaign = new CampaignProgress();
    campaign.setCatalog({ tutorial: { difficulty: 'easy', goals: [{}] } });
    campaign.recordCompletion('tutorial', { time: 50, level: { difficulty: 'easy' } });
    campaign.recordCompletion('tutorial', { time: 35, level: { difficulty: 'easy' } });

    const reloaded = new CampaignProgress();
    reloaded.setCatalog({ tutorial: { difficulty: 'easy', goals: [{}] } });
    assert.equal(reloaded.getLevelProgress('tutorial')?.bestTime, 35);
}

function testMedalThresholds() {
    const level = {
        medals: { goldTime: 20, silverTime: 40, bronzeTime: 80, parTime: 30 },
    };
    assert.equal(computeMedal(19, getMedalThresholds(level)), 'gold');
    assert.equal(computeMedal(39, getMedalThresholds(level)), 'silver');
    assert.equal(computeMedal(79, getMedalThresholds(level)), 'bronze');
    assert.equal(computeMedal(120, getMedalThresholds(level)), null);
}

function testChapterAssignment() {
    assert.equal(getChapterForLevel('tutorial'), 'tutorial');
    assert.equal(getChapterForLevel('neon_dash', { name: 'Neon Dash' }), 'neon');
    assert.equal(getChapterForLevel('full_course', { difficulty: 'expert' }), 'expert');
}

function testChapterLayout() {
    const layout = buildChapterLayout({
        tutorial: { difficulty: 'easy' },
        jump: { difficulty: 'medium' },
        neon_dash: { name: 'Neon Dash', difficulty: 'medium' },
    });
    assert.ok(layout.tutorial.includes('tutorial'));
    assert.ok(layout.classic.includes('jump'));
    assert.ok(layout.neon.includes('neon_dash'));
}

testTutorialUnlocksClassic();
testBestTimePersists();
testMedalThresholds();
testChapterAssignment();
testChapterLayout();
console.log('Campaign progression tests passed');
