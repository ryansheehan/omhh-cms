'use strict';

const { sanitizeEntity } = require('strapi-utils');

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

  async upsertMany(nutrients) {
    // get existing nutrients and create a lookup
    const current = await strapi.query('nutrient').find({_limit: -1});
    const lookup = current.reduce((dict, n)  => {
      const {id, nutrient_id} = n;
      dict[nutrient_id] = id;
      return dict;
    }, {});

    // figure out what is new and what is getting updated
    const newNutrients = [];
    const existingNutrients = [];
    nutrients.forEach(({id, name, unit_name}) => {
      const nutrient = {name, unit_name, nutrient_id: id};
      if(id in lookup) {
        existingNutrients.push(nutrient);
      } else {
        newNutrients.push(nutrient);
      }
    });

    // update existing nutrients
    const updatedNutrients = [];
    existingNutrients.forEach(async nutrient => {
      const id = lookup[nutrient.nutrient_id];
      const updated = await strapi.query('nutrient').update({id}, nutrient);
      updatedNutrients.push(updated);
    });

    // create new nutrients
    const createdNutrients = await strapi.query('nutrient').createMany(newNutrients);

    // return the results;
    return {
      created: createdNutrients.map(n => sanitizeEntity(n)),
      updated: updatedNutrients.map(n => sanitizeEntity(n)),
    };
  }
};
