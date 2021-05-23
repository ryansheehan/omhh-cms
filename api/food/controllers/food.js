'use strict';

const { sanitizeEntity } = require('strapi-utils');


/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async findOne(ctx) {
    const food = await strapi.query('food').findOne({'fdc_id': ctx.params.fdc_id});
    if (food) {
      return sanitizeEntity(food, { model: strapi.models.food });
    } else {
      ctx.status = 404;
      ctx.body = 'not found';
    }
  },

  async update(ctx) {
    const { fdc_id } = ctx.params;

    entity = await strapi.services.food.update({ fdc_id }, ctx.request.body);

    return sanitizeEntity(entity, { model: strapi.models.food });
  },

  async delete(ctx) {
    const { fdc_id } = ctx.params;
    const entity = await strapi.query('restaurant').delete({fdc_id})
    return sanitizeEntity(entity, { model: strapi.models.food });
  },

  async create(ctx) {
    const foods = ctx.request.body;
    try {
      const results = await strapi.services.food.upsertMany(foods);
      results.created = results.created.map(f => sanitizeEntity(f, {model: strapi.models.food}));
      results.updated = results.updated.map(f => sanitizeEntity(f, {model: strapi.models.food}));
      return results;
    } catch(err) {
      strapi.log.error(err);
      ctx.status = 500;
      ctx.body = 'unable to process foods';
    }
  },
};
