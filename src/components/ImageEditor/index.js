import React, { Component } from 'react';
import PropTypes from 'prop-types';

import { getClickPoint, preventDefault } from '../../helpers/event';
import { move, resizeCorner, resizeSide } from '../../helpers/imageEdition';
import { minPositive } from '../../helpers/math';

import SelectedArea from './SelectedArea';

import '../../styles/ImageEditor.scss';

class ImageEditor extends Component {
  constructor(props) {
    super(props);

    this.state = {
      landscape: true,
      isMoving: false,
      isResizing: false,
      resizeVertical: false,
      x0: 0,
      y0: 0,
      x1: 0,
      y1: 0,
      xM: 0,
      yM: 0,
    };

    this.container = null;
    this.image = null;

    this.onImageLoad = this.onImageLoad.bind(this);
    this.getSelectedAreaBoundaries = this.getSelectedAreaBoundaries.bind(this);

    this.startResize = this.startResize.bind(this);
    this.handleResize = this.handleResize.bind(this);

    this.startMove = this.startMove.bind(this);
    this.handleMove = this.handleMove.bind(this);

    this.onMouseMove = this.onMouseMove.bind(this);
    this.onMouseUp = this.onMouseUp.bind(this);

    this.saveEdition = this.saveEdition.bind(this);
  }

  componentWillMount() {
    document.addEventListener('mousemove', this.onMouseMove, false);
    document.addEventListener('onmousemove', this.onMouseMove, false);
    document.addEventListener('mouseup', this.onMouseUp, false);
  }

  componentWillUnmount() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('mouseup', this.onMouseUp);
  }

  /**
   * Set initial selection area according to the maximum posible, and the landscape orientation
   */
  onImageLoad() {
    const { ratio } = this.props;
    const { clientWidth: width, clientHeight: height } = this.image;

    const initialRatio = ratio || 1;
    const landscape = width > height * initialRatio;

    const selectionWidth = landscape ? (height * initialRatio) : width;
    const selectionHeight = landscape ? height : (width / initialRatio);

    const xOffset = landscape ? ((width - selectionWidth) / 2) : 0;
    const yOffset = landscape ? 0 : ((height - selectionHeight) / 2);

    this.setState(state => ({
      ...state,
      landscape,
      x0: xOffset,
      y0: yOffset,
      x1: width - xOffset,
      y1: height - yOffset,
    }));
  }

  /**
   * Takes the selection points relative to the image and transform it into css absolute properties relative to the wrapping div
   * @return {Object} Object containing top, right, bottom and left css properties in percentage (or empty)
   */
  getSelectedAreaBoundaries() {
    if (!this.container) {
      return {};
    }
    const { x0, y0, x1, y1 } = this.state;
    const { clientWidth: width, clientHeight: height } = this.container;
    const { offsetLeft, offsetTop } = this.image;

    return {
      top: `${100*(Math.min(y0, y1) + offsetTop) / height}%`,
      right: `${100*(width - Math.max(x0, x1) - offsetLeft) / width}%`,
      bottom: `${100*(height - Math.max(y0, y1) - offsetTop) / height}%`,
      left: `${100*(Math.min(x0, x1) + offsetLeft) / width}%`,
    };
  }

  startMove(event) {
    event.preventDefault();
    const { clientWidth: width, clientHeight: height } = this.image;

    const { pointX: xM, pointY: yM } = getClickPoint(event, this.container, this.image);

    this.setState({
      isMoving: true,
      xM: minPositive(xM, width),
      yM: minPositive(yM, height),
    });
  }

  handleMove(event) {
    event.preventDefault();
    const { x0, y0, x1, y1, xM, yM } = this.state;
    const { clientWidth: width, clientHeight: height } = this.image;

    const clickPoint = getClickPoint(event, this.container, this.image);

    const points = move(clickPoint, { height, width }, { xM, yM }, { x0, y0, x1, y1 });

    this.setState(points);
  }

  startResize(event, options = {}) {
    event.preventDefault();

    const { invertX, invertY, isResizingSide, resizeVertical } = {
      invertX: false,
      invertY: false,
      isResizingSide: false,
      resizeVertical: false,
      ...options,
    };

    this.setState(state => ({
      ...state,
      isResizing: true,
      isResizingSide: !!isResizingSide,
      resizeVertical: !!resizeVertical,
      x0: invertX ? state.x1 : state.x0,
      y0: invertY ? state.y1 : state.y0,
      x1: invertX ? state.x0: state.x1,
      y1: invertY ? state.y0 : state.y1,
    }));
  }

  handleResize(event) {
    event.preventDefault();

    const { ratio } = this.props;
    const { x0, y0, x1, y1, resizeVertical: resizeVertical, isResizingSide, landscape } = this.state; // landscape aka vertical rules
    const { clientWidth: width, clientHeight: height } = this.image;


    const clickPoint = getClickPoint(event, this.container, this.image);

    const points = isResizingSide
      ? resizeSide(clickPoint, { height, width }, { x0, y0, x1, y1 }, resizeVertical, ratio)
      : resizeCorner(clickPoint, { height, width }, { x0, y0, x1, y1 }, !landscape, ratio);

    this.setState(points);
  }

  onMouseMove(event) {
    const { isResizing, isMoving }= this.state;
    if (isMoving) {
      this.handleMove(event);
    } else if (isResizing) {
      this.handleResize(event);
    }
  }

  onMouseUp(event) {
    const { isResizing, isMoving } = this.state;
    if ( isResizing || isMoving) {
      event.preventDefault();

      this.setState(state => ({
        ...state,
        isResizing: false,
        isResizingSide: false,
        resizeVertical: false,
        x0: Math.min(state.x0, state.x1),
        y0: Math.min(state.y0, state.y1),
        x1: Math.max(state.x0, state.x1),
        y1: Math.max(state.y0, state.y1),
        isMoving: false,
        xM: 0,
        yM: 0,
      }));
    }
  }

  saveEdition() {
    const { onSaveEdition } = this.props;
    const { x0, y0, x1, y1 } = this.state;

    onSaveEdition(this.image, { x0, y0, x1, y1 });
  }

  render() {
    const { image, onCancelEdition } = this.props;

    return (
      <div>
        <div
          className="brainhub-image-editor"
          ref={ref => {
            this.container = ref;
          }}
          onDragStart={preventDefault}
        >
          <img
            ref={ref => {
              this.image = ref;
            }}
            className="brainhub-image-editor__image"
            src={image}
            onLoad={this.onImageLoad}/>
          <SelectedArea
            startMove={this.startMove}
            startResize={this.startResize}
            style={this.getSelectedAreaBoundaries()}
          />
        </div>
        <div>
          <button
            className="brainhub-image-editor__button brainhub-image-editor__button--cancel"
            onClick={onCancelEdition}>
          Cancel
          </button>
          <button
            className="brainhub-image-editor__button brainhub-image-editor__button--save"
            onClick={this.saveEdition}>
          Save image
          </button>
        </div>
      </div>
    );
  }
}

ImageEditor.defaultProps = {
  ratio: 0, // heigh / width
};

ImageEditor.propTypes = {
  image: PropTypes.string.isRequired,
  ratio: PropTypes.number,
  onCancelEdition: PropTypes.func.isRequired,
  onSaveEdition: PropTypes.func.isRequired,
};

export default ImageEditor;
