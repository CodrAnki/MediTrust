import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { similarity, matchMedicine } from '../services/medicineMatchService.js';

function fakeMedicineModel(records) {
  return {
    find: () => ({
      lean: async () => records,
    }),
  };
}

describe('medicineMatchService.similarity', () => {
  test('identical strings (ignoring case/punctuation) -> 1', () => {
    assert.equal(similarity('ZOXFER-XT PLUS', 'zoxfer xt plus'), 1);
  });
  test('completely different strings -> low similarity', () => {
    assert.ok(similarity('Zoxvitaz-L', 'Safezyme Syrup') < 0.4);
  });
  test('empty input -> 0', () => {
    assert.equal(similarity('', 'Zoxvitaz-L'), 0);
  });
});

describe('medicineMatchService.matchMedicine', () => {
  const medicines = [
    { _id: '1', medicineName: 'Zoxvitaz-L', manufacturer: 'Zoxvina Biotech Pvt. Ltd.' },
    { _id: '2', medicineName: 'Palzit-DSR', manufacturer: 'Zoxvina Biotech Pvt. Ltd.' },
    { _id: '3', medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.' },
    { _id: '4', medicineName: 'Zovifast-AQ', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', strength: '75mg' },
    { _id: '5', medicineName: 'Safezyme Syrup', manufacturer: 'Best Biotech' },
  ];

  test('clean OCR text for a genuine saved medicine matches confidently', async () => {
    const MedicineModel = fakeMedicineModel(medicines);
    const result = await matchMedicine(
      { medicineName: 'ZOXFER-XT PLUS', manufacturer: 'Zoxvina Biotech Pvt. Ltd.' },
      { MedicineModel }
    );
    assert.equal(result.status, 'MATCH');
    assert.equal(result.medicine.medicineName, 'ZOXFER-XT PLUS');
  });

  test('near-identical OCR noise (minor typo) still matches the right medicine, not a different one', async () => {
    const MedicineModel = fakeMedicineModel(medicines);
    const result = await matchMedicine(
      { medicineName: 'ZOXFER-XT PLU5', manufacturer: 'Zoxvina Biotech Pvt Ltd' },
      { MedicineModel }
    );
    assert.equal(result.status, 'MATCH');
    assert.equal(result.medicine.medicineName, 'ZOXFER-XT PLUS');
  });

  test('strength mismatch blocks an otherwise-close match (never a manufactured pass)', async () => {
    const MedicineModel = fakeMedicineModel(medicines);
    const result = await matchMedicine(
      { medicineName: 'Zovifast-AQ', manufacturer: 'Zoxvina Biotech Pvt. Ltd.', strength: '150mg' },
      { MedicineModel }
    );
    assert.equal(result.status, 'MISMATCH');
  });

  test('no saved reference medicines at all -> REFERENCE_NOT_FOUND, not a silent guess', async () => {
    const MedicineModel = fakeMedicineModel([]);
    const result = await matchMedicine({ medicineName: 'Anything', manufacturer: 'Anyone' }, { MedicineModel });
    assert.equal(result.status, 'REFERENCE_NOT_FOUND');
    assert.equal(result.medicine, null);
  });

  test('the globally best-scoring candidate is still correctly rejected when it is not actually close enough (item 3 guard)', async () => {
    const MedicineModel = fakeMedicineModel(medicines);
    const result = await matchMedicine(
      { medicineName: 'Completely Unrelated Product Name', manufacturer: 'Some Other Company' },
      { MedicineModel }
    );
    assert.equal(result.status, 'MISMATCH');
  });
});
