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

    // validate the foods we need to process
    const validatedPromises = await Promise.allSettled(
      foods.map(food => strapi.entityValidator.validateEntityUpdate(strapi.models.food, food))
    );

    // collect any foods that fail to process
    errors.concat(
      validatedPromises
        .filter(({status}) => status === 'rejected')
        .map(({reason}) => reason)
    );

    // make a map of all the foods that have valid data
    const newFoodsList = validatedPromises
      .filter(({status}) => status === 'fulfilled')
      .map(({value}) => value);


    const newFoods = newFoodsList.reduce((col, food) => {
      col[food.fdc_id] = food;
      return col;
    }, {});

    // gather a list of the valid food ids so we can determine what foods
    // are being updated vs which foods are new
    const fdc_ids = Object.keys(newFoods);

    // find existing foods
    const foodsToBeUpdatedQuery = await strapi.query('food')
      .model.query(qb => {
        qb.where('fdc_id', 'in', fdc_ids)
      })
      .fetchAll();

    const foodsToBeUpdated = foodsToBeUpdatedQuery.toJSON();
    const skippedFoods = {};
    const existingFoods = foodsToBeUpdated
      // compare new food to the existing food and decide if anything has actually changed
      .filter(({fdc_id, description, nutrients, source}) => {
        const newFood = newFoods[fdc_id];
        const newFoodNutrientMap = newFood.nutrients.reduce((m, n) => {
          m[n.nutrient] = n.amount;
          return m;
        },{});

        const shouldUpdate = description != newFood.description ||
          source != newFood.source ||
          nutrients.length != newFood.nutrients.length ||
          !nutrients.every(({nutrient, amount}) => {
            const {id} = nutrient;
            return id in newFoodNutrientMap && amount === newFoodNutrientMap[id];
          });

        if (!shouldUpdate) {
          skippedFoods[fdc_id] = newFood;
        }

        return shouldUpdate;
      })
      .reduce((col, food) => {
        col[food.fdc_id] = food;
        return col;
      }, {});


    // find foods that do not already exist
    const foodsToAdd = [];
    fdc_ids.forEach(fid => {
      if (! (fid in existingFoods) && ! (fid in skippedFoods)) {
        foodsToAdd.push(newFoods[fid]);
      }
    });

    // update existing foods

    const plist = foodsToBeUpdated
      .filter(({fdc_id}) => fdc_id in existingFoods)
      .map(
        ({id, fdc_id}) => strapi.query('food').update({id}, newFoods[fdc_id])
      );

    const updatedPromises = await Promise.allSettled(plist);

    const updatedErrors = updatedPromises
      .filter(({status}) => status === 'rejected')
      .map(({reason}) => reason);

    // collect errors
    errors.concat(updatedErrors);

    // get finalized results
    const foodsUpdated = updatedPromises
      .filter(({status}) => status === 'fulfilled')
      .map(({value}) => value);

    const updatesSkipped = foodsToBeUpdated.length - (updatedErrors.length + foodsUpdated.length);

    // add new foods
    // const addedFoods = await strapi.query('food').createMany(foodsToAdd);

    const knex = strapi.connections.default;

    // insert into foods
    const foodObjs = foodsToAdd.map(({fdc_id, description, source}) => ({fdc_id, description, source}));
    const [firstAddedId] = await knex('foods')
      .insert(foodObjs)
      .returning('id');
    const foodsAdded = Array.from({length: foodsToAdd.length}, (_, i) => i + firstAddedId);

    // insert into components_nutrition_food_nutrients
    const foodNutrientsAdded = {};
    for await(const [i, food] of foodsToAdd.entries()) {
      const [firstAdded] = await knex('components_nutrition_food_nutrients')
        .insert(food.nutrients)
        .returning('id');

      foodNutrientsAdded[foodsAdded[i]] = Array.from({length: food.nutrients.length}, (_, i) => i + firstAdded);
    }

    // insert into foods_components
    const food_components = Object.entries(foodNutrientsAdded).flatMap(
      ([food_id, nutrientIds]) =>
        nutrientIds.map((component_id, order) => ({
          field: 'nutrients',
          order: order + 1,
          component_type: 'components_nutrition_food_nutrients',
          component_id,
          food_id,
        }))
    );
    await knex('foods_components').insert(food_components);

    // select all the foods added
    const addedFoodsQuery = await strapi.query('food')
      .model.query(qb => {
        qb.where('id', 'in', foodsAdded)
      })
      .fetchAll();
    const addedFoods = addedFoodsQuery.toJSON();

    // return results
    return {
      created: addedFoods,
      updated: foodsUpdated,
      skipped: updatesSkipped,
      errors,
    };
  }
};
