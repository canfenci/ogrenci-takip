import assert from 'node:assert/strict';
import test from 'node:test';

import { BRANCH_BADGES, buildAdaptiveStudyPlan, calculateStudyProfile, getStudyBadge } from '../study-plan-engine.js';

test('defines three-stage badges for every supported study branch', () => {
  assert.deepEqual(BRANCH_BADGES['Fen Bilimleri'], { beginner: 'Bilim Kaşifi', intermediate: 'Deney Uzmanı', advanced: 'Bilim Ustası' });
  assert.equal(getStudyBadge('Matematik', 'advanced'), 'Matematik Stratejisti');
  assert.equal(getStudyBadge('Türkçe', 'intermediate'), 'Anlam Avcısı');
  assert.equal(getStudyBadge('Sosyal Bilgiler', 'beginner'), 'Tarih Kaşifi');
});

test('automatically derives stage and intensity from branch results and homework completion', () => {
  const student = {
    denemeler: [
      { tip: 'genel', dersSonuclari: { 'Fen Bilimleri': { dogru: 18, yanlis: 2, bos: 0 } } },
      { tip: 'genel', dersSonuclari: { 'Fen Bilimleri': { dogru: 17, yanlis: 3, bos: 0 } } }
    ],
    odevler: [
      { ders: 'Fen Bilimleri', durum: 'tamamlandi' },
      { ders: 'Fen Bilimleri', durum: 'tamamlandi' }
    ]
  };
  const profile = calculateStudyProfile(student, 'Fen Bilimleri');
  assert.equal(profile.stage, 'advanced');
  assert.equal(profile.intensity, 'intensive');
  assert.equal(profile.dataPoints, 4);
});

test('builds a selected-day plan with learning techniques and intensity limits', () => {
  const plan = buildAdaptiveStudyPlan({
    subject: 'Matematik',
    stage: 'intermediate',
    intensity: 'balanced',
    techniques: ['feynman', 'spaced'],
    days: ['Pazartesi', 'Perşembe'],
    dailyMinutes: 45
  });
  assert.match(plan.Pazartesi[0], /Matematik/);
  assert.match(plan.Pazartesi[0], /Feynman Tekniği/);
  assert.match(plan.Perşembe[0], /Aralıklı Tekrar/);
  assert.equal(plan.Salı.length, 0);
});
