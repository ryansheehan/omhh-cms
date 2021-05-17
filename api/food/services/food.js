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

  async upsertFoods(foods) {
    const fdc_ids = foods.map(f => f.fdc_id);
    // const current = await strapi.query('food').
  }
};
