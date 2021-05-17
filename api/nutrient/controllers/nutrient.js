'use strict';
const { sanitizeEntity } = require('strapi-utils');
const { create } = require('../../food/controllers/food');

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async findOne(ctx) {
    const { id } = ctx.params;

    const entity = await strapi.services.nutrient.findOneByNutrientId(id);
    const results = sanitizeEntity(entity, { model: strapi.models.nutrient });
    return results;
  },
  async create(ctx) {
    const nutrients = ctx.request.body;
    try {
      const results = await strapi.services.nutrient.upsertMany(nutrients);
      return results;
    } catch(err) {
      strapi.log.error(err);
      ctx.status = 500;
      ctx.body = 'unable to process nutrients';
    }
  }
};
