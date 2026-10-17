import assert from 'node:assert/strict';
import { CampaignProgress, CAMPAIGN_STORAGE_KEY } from '../src/game/systems/campaign-progress.ts';
import {
    CAMPAIGN_CHAPTERS,
    LEVEL_UNLOCK_SLACK,
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
        canyon_run: { difficulty: 'medium' },
        castle_siege: { difficulty: 'easy' },
        neon_dash: { name: 'Neon Dash', difficulty: 'medium' },
    });
    assert.ok(layout.tutorial.includes('tutorial'));
    assert.deepEqual(layout.classic, ['canyon_run', 'castle_siege'], 'listed levels keep their authored order');
    assert.ok(layout.neon.includes('neon_dash'));
}

function testInChapterGating() {
    globalThis.localStorage = mockStorage();
    const ids = CAMPAIGN_CHAPTERS.find((c) => c.id === 'tutorial').levels;
    const campaign = new CampaignProgress();
    campaign.setCatalog(Object.fromEntries(ids.map((id) => [id, { difficulty: 'easy', goals: [{}] }])));
    const gated = ids[LEVEL_UNLOCK_SLACK + 1];
    assert.equal(campaign.isLevelPlayable(ids[0]), true);
    assert.equal(campaign.isLevelPlayable(gated), false, 'later tutorial levels start locked');
    campaign.recordCompletion(ids[0], { time: 10, level: { difficulty: 'easy' } });
    assert.equal(campaign.isLevelPlayable(gated), true, 'a completion opens the next level');
    campaign.setFreePlay(true);
    assert.equal(campaign.isLevelPlayable(ids[ids.length - 1]), true, 'free play ignores gating');
}

testTutorialUnlocksClassic();
testBestTimePersists();
testMedalThresholds();
testChapterAssignment();
testChapterLayout();
testInChapterGating();
console.log('Campaign progression tests passed');
