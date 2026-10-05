import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCSV} from '../lib/os/csv.ts';
test('CSV supports BOM, commas, escaped quotes and multiline product names',()=>{assert.deepEqual(parseCSV('\ufeffname,sku,price\r\n"Уход, SPF",A1,1800\r\n"Cream ""Daily""\n50 ml",A2,2000'),[['name','sku','price'],['Уход, SPF','A1','1800'],['Cream "Daily"\n50 ml','A2','2000']])});
test('CSV ignores empty lines and rejects malformed quoted input',()=>{assert.deepEqual(parseCSV('name,sku\n\nTest,A1\n'),[['name','sku'],['Test','A1']]);assert.throws(()=>parseCSV('name,sku\n"Broken,A1'),/кавычку/)});
