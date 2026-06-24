const fs = require('fs');
const files = [
  'landing/src/components/SectionFeatures.vue',
  'landing/src/components/SectionSkills.vue',
  'landing/src/components/SectionFAQ.vue',
  'landing/src/components/SectionShowcase.vue',
  'landing/src/components/SectionDownload.vue',
  'landing/src/components/SectionPricing.vue'
];
for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const ids = (c.match(/id=["']([^"']+)["']/g) || []).map(s => s.match(/["']([^"']+)["']/)[1]);
  console.log(f.split('/').pop(), '→', ids);
}