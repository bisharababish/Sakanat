module.exports = function (api) {
  api.cache.using(() => process.env.EXPO_PUBLIC_USE_RN_FETCH ?? '');
  return {
    presets: [require.resolve('babel-preset-expo')],
  };
};
