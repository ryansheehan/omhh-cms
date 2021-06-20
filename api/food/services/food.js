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
        .filter(({ status }) => status === 'rejected')
        .map(({ reason }) => reason)
    );

    // make a map of all the foods that have valid data
    const newFoodsList = validatedPromises
      .filter(({ status }) => status === 'fulfilled')
      .map(({ value }) => value);


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
      .filter(({ fdc_id, description, nutrients, portions, brand, source }) => {
        const newFood = newFoods[fdc_id];

        const isNutrientsEqual = function (n, nn) {
          if (!!n && !!nn && n.length !== nn.length) {
            return false;
          }

          const newFoodNutrientMap = nn.reduce((m, n) => {
            m[n.name] = { amount: n.amount, unit_name: n.unit_name };
            return m;
          }, {});

          return n.every(({ name, amount, unit_name }) => {
            return name in newFoodNutrientMap &&
              amount === newFoodNutrientMap[name].amount &&
              unit_name === newFoodNutrientMap[name].unit_name;
          })
        }

        const isPortionsEqual = function (p, np) {
          if (!!p && !!np && p.length !== np.length) {
            return false;
          }

          return p.every(({ amount, unit, gram_weight, portion_description, modifier }) => {
            return np.some(newPortion => {
              return newPortion.amount === amount &&
                newPortion.unit === unit &&
                newPortion.gram_weight === gram_weight &&
                newPortion.portion_description === portion_description &&
                newPortion.modifier === modifier;
            });
          })
        }

        const isBrandEqual = function (b, nb) {
          if (!!b && !!nb) {
            return b.brand_owner === nb.brand_owner &&
              b.brand_name === nb.brand_name &&
              b.subbrand_name === nb.subbrand_name &&
              b.serving_size === nb.serving_size &&
              b.serving_size_unit === nb.serving_size_unit &&
              b.household_serving_fulltext === nb.household_serving_fulltext;
          }
          return true;
        }

        const shouldUpdate = description != newFood.description ||
          source != newFood.source ||
          !isNutrientsEqual(nutrients, newFood.nutrients) ||
          !isPortionsEqual(portions, newFood.portions) ||
          !isBrandEqual(brand, newFood.brand);

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
      if (!(fid in existingFoods) && !(fid in skippedFoods)) {
        foodsToAdd.push(newFoods[fid]);
      }
    });

    // update existing foods

    const plist = foodsToBeUpdated
      .filter(({ fdc_id }) => fdc_id in existingFoods)
      .map(
        ({ id, fdc_id }) => strapi.query('food').update({ id }, newFoods[fdc_id])
      );

    const updatedPromises = await Promise.allSettled(plist);

    const updatedErrors = updatedPromises
      .filter(({ status }) => status === 'rejected')
      .map(({ reason }) => reason);

    // collect errors
    errors.concat(updatedErrors);

    // get finalized results
    const foodsUpdated = updatedPromises
      .filter(({ status }) => status === 'fulfilled')
      .map(({ value }) => value);

    const updatesSkipped = foodsToBeUpdated.length - (updatedErrors.length + foodsUpdated.length);

    // Keep this code, it's used to reverse engineer how foods are added
    // const addedFoods = await strapi.query('food').createMany(foodsToAdd);

    const knex = strapi.connections.default;

    // insert into foods
    const createdFoods = [];
    if (foodsToAdd.length > 0) {
      const foodObjs = foodsToAdd.map(({ fdc_id, description, source }) => ({ fdc_id, description, source }));
      const [firstAddedId] = await knex('foods')
        .insert(foodObjs);

      const foodsAdded = Array.from({ length: foodsToAdd.length }, (_, i) => i + firstAddedId);

      // insert components
      const foodNutrientsAdded = {};
      const foodPortionsAdded = {};
      const brand_components = [];
      for await (const [i, food] of foodsToAdd.entries()) {
        // insert into components_nutrition_food_nutrients
        if (food.nutrients) {
          const [firstNutrientIdAdded] = await knex('components_nutrition_food_nutrients')
            .insert(food.nutrients);

          foodNutrientsAdded[foodsAdded[i]] = Array.from({ length: food.nutrients.length }, (_, i) => i + firstNutrientIdAdded);
        }

        // insert into components_nutrition_food_portions
        if (food.portions && food.portions.length > 1) {
          const [firstPortionIdAdded] = await knex('components_nutrition_food_portions')
            .insert(food.portions);

          foodPortionsAdded[foodsAdded[i]] = Array.from({ length: food.portions.length }, (_, i) => i + firstPortionIdAdded);
        }

        // insert into components_nutrition_food_brand
        if (food.brand) {
          const [brand_component_id] = await knex('components_nutrition_food_brand')
            .insert(food.brand);

          brand_components.push({
            field: 'brand',
            order: 1,
            component_type: 'components_nutrition_food_brand',
            component_id: brand_component_id,
            food_id: foodsAdded[i]
          });
        }
      }

      // collect nutrient components
      const nutrient_components = Object.entries(foodNutrientsAdded).flatMap(
        ([food_id, nutrientIds]) =>
          nutrientIds.map((component_id, order) => ({
            field: 'nutrients',
            order: order + 1,
            component_type: 'components_nutrition_food_nutrients',
            component_id,
            food_id,
          }))
      );

      // collect portion components
      const portion_components = Object.entries(foodPortionsAdded).flatMap(
        ([food_id, nutrientIds]) =>
          nutrientIds.map((component_id, order) => ({
            field: 'portions',
            order: order + 1,
            component_type: 'components_nutrition_food_portions',
            component_id,
            food_id,
          }))
      );

      // write concat of nutrients, portions, and brand to food_components table
      const food_components = [...nutrient_components, ...portion_components, ...brand_components];
      if (food_components.length > 0) {
        await knex('foods_components').insert(food_components);
      }

      // select all the foods added
      const addedFoodsQuery = await strapi.query('food')
        .model.query(qb => {
          qb.where('id', 'in', foodsAdded)
        })
        .fetchAll();
      const addedFoods = addedFoodsQuery.toJSON();
      createdFoods.push(...addedFoods);
    }

    // return results
    return {
      created: createdFoods,
      updated: foodsUpdated,
      skipped: updatesSkipped,
      errors,
    };
  }
};
