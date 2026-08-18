const React = require('react');
const { View } = require('react-native');

function useVideoPlayer() {
  return {
    addListener: () => ({ remove: () => {} }),
  };
}

const VideoView = React.forwardRef((props, ref) =>
  React.createElement(View, { ...props, ref, testID: props.testID || 'video-view' }),
);

module.exports = {
  VideoView,
  useVideoPlayer,
};
