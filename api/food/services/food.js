'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  async deleteAllButCustom() {
    const knex = strapi.connections.default;
    try {

      // knex does not support join delete
      // we must delete all the foods_components links where
      // the linked foods item is not from a custom source
      const result = await knex.raw("DELETE fc FROM foods_components fc INNER JOIN foods f ON f.id = fc.food_id WHERE f.source != 'custom'");

      const result2 = await knex('foods')
      .where('foods.source', 'custom')
      .delete();

      return [result, result2];
    } catch (err) {
      throw err;
    }
  },

  async update(params, data) {
    const existingEntry = await strapi.query('food').findOne(params);

    const validData = await strapi.entityValidator.validateEntityUpdate(
      strapi.models.food,
      data,
    );

    const entry = await strapi.query('food').update(params, validData);

    return entry;
  },

  async upsertMany(foods) {
    const errors = [];

    const validatedPromises = await Promise.allSettled(
      foods.map(food => strapi.entityValidator.validateEntityUpdate(strapi.models.food, food))
    );

    errors.concat(
      validatedPromises
        .filter(({status}) => status === 'rejected')
        .map(({reason}) => reason)
    );

    const newFoods = validatedPromises
      .filter(({status}) => status === 'fulfilled')
      .map(({value}) => value)
      .reduce((col, food) => {
        col[food.fdc_id] = food;
        return col;
      }, {});

    const fdc_ids = Object.keys(newFoods);

    // find existing foods
    const foodsToBeUpdatedQuery = await strapi.query('food')
      .model.query(qb => {
        qb.where('fdc_id', 'in', fdc_ids)
      })
      .fetchAll();

    const foodsToBeUpdated = foodsToBeUpdatedQuery.toJSON();

    const existingFoods = foodsToBeUpdated.reduce((col, food) => {
      col[food.fdc_id] = food;
      return col;
    }, {});

    // find foods that do not already exist
    const foodsToAdd = [];
    fdc_ids.forEach(fid => {
      if (! (fid in existingFoods)) {
        foodsToAdd.push(newFoods[fid]);
      }
    });

    // update existing foods
    const updatedPromises = await Promise.allSettled(foodsToBeUpdated.map(
      ({id, fdc_id}) => strapi.query('food').update({id}, newFoods[fdc_id])
    ));

    // collect errors
    errors.concat(
      updatedPromises
        .filter(({status}) => status === 'rejected')
        .map(({reason}) => reason)
    );

    // get finalized results
    const foodsUpdated = updatedPromises
      .filter(({status}) => status === 'fulfilled')
      .map(({value}) => value);


    // add new foods
    const addedFoods = await strapi.query('food').createMany(foodsToAdd);

    // return results
    return {
      created: addedFoods,
      updated: foodsUpdated,
      errors,
    };
  }
};
