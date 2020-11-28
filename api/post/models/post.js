'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/v3.x/concepts/models.html#lifecycle-hooks)
 * to customize this model
 */

 const slugify = require('slugify');

module.exports = {
  lifecycles: {
    beforeCreate: async (data) => {
      const {title} = data;
      if (title) {
        data.slug = slugify(title, {lower: true, strict: true});
      }
    },
    beforeUpdate: async (_, data) => {
      const {title} = data;
      if (title) {
        data.slug = slugify(title, {lower: true, strict: true});
      }
    }
  }
};
