const validateRequest = (schema, data, res, file) => {
  return new Promise(async (resolve, reject) => {
    const result = await schema.safeParseAsync(data);

    if (!result.success) {
      // Build an object keyed by "dot.path" → { type, message }
      const errors = {};
      // grabs the result and parses the errors from the zod safe parse function
      result.error.errors.forEach((e) => {
        const name = e.path.length ? e.path.join(".") : "_error";
        errors[name] = {
          type: "server", // you can choose 'server' or 'manual'
          message: e.message, // the Zod‐generated message
        };
      });

      // e.g. { errors: { "user.name": { type:"server", message:"..." }, ... } }
      // return res.status(400).json({ errors });
      if (file) {
        resolve(errors); // Changed from return to resolve
      } else {
        return res.status(400).json({ errors });
      }
      return;
    }

    resolve(result.data);
  });
};

module.exports = validateRequest;
