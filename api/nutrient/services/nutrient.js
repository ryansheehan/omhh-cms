'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

module.exports = {
  async deleteAll() {
    const knex = strapi.connections.default;
    return await knex('nutrients')
      .delete();
  },

  findOneByNutrientId(nutrient_id) {
    return strapi.query('nutrient').findOne({nutrient_id});
  },

  async create(data) {
    const validData = await strapi.entityValidator.validateEntityCreation(
      strapi.models.nutrient,
      data
    );

    const entry = await strapi.query('nutrient').create(validData);

    return entry;
  }
};
