import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyMedicine } from '../services/medicineIdentificationService.js';

const medicine = {
  _id: 'medicine-id',
  medicineName: 'ZOXFER-XT PLUS',
  manufacturer: 'Zoxvina Biotech Pvt. Ltd.',
  composition: 'Ferrous Bisglycinate 60mg, Zinc Bisglycinate 15mg, Folic Acid 1mg, Methylcobalamin 500mcg',
  strength: '60 mg + 15 mg + 1 mg + 500 mcg',
};

function medicineModel(records) {
  return { find: () => ({ lean: async () => records }) };
}

test('identifies a medicine from the local reference database', async () => {
  const result = await identifyMedicine({
    medicineName: medicine.medicineName,
    manufacturer: medicine.manufacturer,
    genericName: medicine.composition,
    strength: medicine.strength,
  }, { MedicineModel: medicineModel([medicine]) });

  assert.equal(result.medicineMatch.status, 'MATCH');
  assert.equal(result.medicineIdentification.source, 'local');
  assert.equal(result.medicineIdentification.medicineId, medicine._id);
  assert.equal(result.medicineIdentification.nameMatched, true);
  assert.equal(result.medicineIdentification.manufacturerMatched, true);
  assert.equal(Object.hasOwn(result.medicineIdentification, 'drugSetu'), false);
});

test('reports an unknown medicine when the local reference database has no records', async () => {
  const result = await identifyMedicine({ medicineName: 'Unknown medicine' }, { MedicineModel: medicineModel([]) });

  assert.equal(result.medicineMatch.status, 'REFERENCE_NOT_FOUND');
  assert.equal(result.medicineIdentification.source, 'none');
  assert.equal(result.medicineIdentification.medicineId, null);
});
