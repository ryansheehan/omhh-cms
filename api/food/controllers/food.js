'use strict';

const sqlite3 = require('sqlite3').verbose();
const { parseMultipartData, sanitizeEntity } = require('strapi-utils');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

function LoadDatabaseAsync(path) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(
      `${path}`,
      sqlite3.OPEN_READONLY,
      err => err ? reject(err) : resolve(db)
    );
  });
}

function baseQuery(fn, strings, tokens) {
  const out = [strings[0]];
  for(let i = 1; i < strings.length; i++) {
    out.push(tokens[i-1], strings[i]);
  }
  const query = out.join('');
  return new Promise((resolve, reject) => {
    fn(query, (err, rows) => err ? reject(err) : resolve(rows));
  });
}

module.exports = {
  async create(ctx) {
    if (ctx.is('multipart')) {
      const {data, files} = parseMultipartData(ctx);

      let db = undefined;
      try {
        db = await LoadDatabaseAsync(files.db.path);
      } catch (err) {
        return ctx.badRequest('Unable to open database');
      }

      function all(strings, ...tokens) {
        return baseQuery((q, cb) => db.all(q, cb), strings, tokens);
      }

      function get(strings, ...tokens) {
        return baseQuery((q, cb) => db.get(q, cb), strings, tokens);
      }

      try {
        // delete old food data
        await Promise.all([
          strapi.services.food.deleteAllButCustom(),
          strapi.services.nutrient.deleteAll(),
        ]);

        // populate nutrient info
        const nutrientTable = await all`SELECT name, unit_name, id AS nutrient_id FROM nutrient`;
        const nutrientResults = await strapi.query('nutrient').createMany(nutrientTable);

        // create nutrient lookup table
        const nutrientLookUp = nutrientResults.reduce((dict, n) => {
          const {nutrient_id, id} = n;
          dict[nutrient_id] = id;
          return dict;
        }, {});

        const foodIds = await all`SELECT fdc_id FROM food`;
        const batchSize = 100;
        for(let i = 0; i < foodIds.length; i += batchSize) {
          const foods = [];
          for(let j = 0; j < 100 && i + j < foodIds.length; j++) {
            const {fdc_id} = foodIds[i + j];
            const foodPromise = get`SELECT fdc_id, description, data_type AS source FROM food WHERE fdc_id = ${fdc_id}`;
            const nutrientsPromise = all`
              SELECT fn.amount, fn.nutrient_id
              FROM food_nutrient fn
              WHERE fn.fdc_id = ${fdc_id}`;
            const [food, nutrients] = await Promise.all([foodPromise, nutrientsPromise]);
            const strapiFood = {
              ...food,
              nutrients: nutrients.map(({amount, nutrient_id}) => ({amount, nutrient: nutrientLookUp[nutrient_id]}))
            };
            foods.push(strapiFood);
          }
          const results = await strapi.query('food').createMany(foods);
          let junk = 0;
          junk += 1;
        }
      } catch (err) {
        return ctx.badRequest({
          error: 'Invalid data.',
          details: err,
        });
      }

    } else {
      return ctx.badRequest({
        error: 'Invalid data.',
      });
    }
  }
};
