'use strict';
const { sanitizeEntity } = require('strapi-utils');

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
    // validate header

    // const results = await strapi.query('nutrient').createMany([
    //   {name: 'Bulk 1', unit_name: 'mg', nutrient_id: 9988},
    //   {name: 'Bulk 1', unit_name: 'mg', nutrient_id: 9987},
    // ]);

    // call service with body text
    return ctx.send({
      result: ctx.request.body
    });
  },
};
