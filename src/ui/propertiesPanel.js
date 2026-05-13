import * as THREE from 'three';
import { catalog } from '../catalog/index.js';

export function createPropertiesPanel({ getObject, snapToGrid, onChange }) {
  const noSelection = document.getElementById('no-selection');
  const propertiesForm = document.getElementById('properties-form');
  const propType = document.getElementById('prop-type');
  const propX = document.getElementById('prop-x');
  const propZ = document.getElementById('prop-z');
  const propY = document.getElementById('prop-y');
  const propRotation = document.getElementById('prop-rotation');
  const propWidthRow = document.getElementById('prop-width-row');
  const propWidth = document.getElementById('prop-width');
  const propHeightLabel = document.getElementById('prop-height-label');
  const propHeight = document.getElementById('prop-height');
  const propDepthRow = document.getElementById('prop-depth-row');
  const propDepth = document.getElementById('prop-depth');
  const propDepthLabel = document.getElementById('prop-depth-label');
  const propDeckDepthRow = document.getElementById('prop-deck-depth-row');
  const propDeckDepth = document.getElementById('prop-deck-depth');
  const propFlatLengthRow = document.getElementById('prop-flat-length-row');
  const propFlatLength = document.getElementById('prop-flat-length');
  const propDegreesRow = document.getElementById('prop-degrees-row');
  const propDegreesLabel = document.getElementById('prop-degrees-label');
  const propDegrees = document.getElementById('prop-degrees');
  const propTopRadiusRow = document.getElementById('prop-top-radius-row');
  const propTopRadiusLabel = document.getElementById('prop-top-radius-label');
  const propTopRadius = document.getElementById('prop-top-radius');
  const propStepCountRow = document.getElementById('prop-step-count-row');
  const propStepCount = document.getElementById('prop-step-count');

  function update() {
    const object = getObject();

    noSelection.hidden = Boolean(object);
    propertiesForm.hidden = !object;

    if (!object) {
      return;
    }

    propType.value = catalog[object.type]?.label ?? object.type;
    propX.value = object.position.x.toFixed(2);
    propZ.value = object.position.z.toFixed(2);
    propY.value = object.position.y.toFixed(2);
    propRotation.value = THREE.MathUtils.radToDeg(object.rotation.y).toFixed(0);

    const showWidth = ['box', 'ledge', 'quarterPipe', 'halfPipe', 'stairs'].includes(object.type);
    const showDepth = ['box', 'ledge'].includes(object.type);
    const showRadius = ['quarterPipe', 'halfPipe', 'corner', 'hip', 'volcano'].includes(object.type);
    const showLength = ['bank', 'pyramid', 'rail'].includes(object.type);

    propWidthRow.hidden = !showWidth;
    propWidth.value = object.params.width ?? '';

    propHeightLabel.textContent = object.type === 'stairs' ? 'Stair Height' : 'Height';
    propHeight.value = object.params.height;

    propDepthRow.hidden = !(showDepth || showRadius || showLength);

    if (showRadius) {
      propDepthLabel.textContent = 'Radius';
      propDepth.dataset.prop = 'params.radius';
      propDepth.value = object.params.radius ?? object.params.depth ?? 2;
    } else if (showLength) {
      propDepthLabel.textContent = object.type === 'pyramid' ? 'Bank Length' : 'Length';
      propDepth.dataset.prop = 'params.length';
      propDepth.value = object.params.length;
    } else if (showDepth) {
      propDepthLabel.textContent = 'Depth';
      propDepth.dataset.prop = 'params.depth';
      propDepth.value = object.params.depth;
    }

    propDeckDepthRow.hidden = object.type !== 'quarterPipe' && object.type !== 'halfPipe' && object.type !== 'corner';
    propDeckDepth.value = object.params.deckDepth ?? 0.8;

    propFlatLengthRow.hidden = object.type !== 'halfPipe';
    propFlatLength.value = object.params.flatLength ?? 1.5;

    propDegreesRow.hidden = object.type !== 'corner' && object.type !== 'hip';
    propDegreesLabel.textContent = object.type === 'hip' ? 'Sweep Angle' : 'Degrees';
    propDegrees.value = object.params.degrees ?? 90;

    propTopRadiusRow.hidden = object.type !== 'volcano' && object.type !== 'pyramid';
    propTopRadiusLabel.textContent = object.type === 'pyramid' ? 'Top Size' : 'Top Radius';
    propTopRadius.dataset.prop = object.type === 'pyramid' ? 'params.topSize' : 'params.topRadius';
    propTopRadius.value = object.type === 'pyramid'
      ? object.params.topSize ?? 1.2
      : object.params.topRadius ?? 0.6;

    propStepCountRow.hidden = object.type !== 'stairs';
    propStepCount.value = object.params.stepCount ?? 5;
  }

  function applyPropertyChange(input) {
    const object = getObject();
    const value = Number(input.value);

    if (!object || !Number.isFinite(value)) {
      return;
    }

    if (input.dataset.prop === 'position.x') {
      object.position.x = snapToGrid(value);
    } else if (input.dataset.prop === 'position.z') {
      object.position.z = snapToGrid(value);
    } else if (input.dataset.prop === 'position.y') {
      object.position.y = value;
    } else if (input.dataset.prop === 'rotation.y') {
      object.rotation.y = THREE.MathUtils.degToRad(value);
    } else if (input.dataset.prop === 'params.width') {
      object.params.width = Math.max(0.1, value);
    } else if (input.dataset.prop === 'params.height') {
      object.params.height = Math.max(0.1, value);
    } else if (input.dataset.prop === 'params.depth') {
      object.params.depth = Math.max(0.1, value);
    } else if (input.dataset.prop === 'params.radius') {
      object.params.radius = Math.max(0.1, value);
      delete object.params.depth;
    } else if (input.dataset.prop === 'params.deckDepth') {
      object.params.deckDepth = Math.max(0, value);
    } else if (input.dataset.prop === 'params.flatLength') {
      object.params.flatLength = Math.max(0, value);
    } else if (input.dataset.prop === 'params.degrees') {
      object.params.degrees = THREE.MathUtils.clamp(value, 1, 180);
    } else if (input.dataset.prop === 'params.topRadius') {
      object.params.topRadius = Math.max(0, value);
    } else if (input.dataset.prop === 'params.topSize') {
      object.params.topSize = Math.max(0, value);
    } else if (input.dataset.prop === 'params.length') {
      object.params.length = Math.max(0.1, value);
    } else if (input.dataset.prop === 'params.stepCount') {
      object.params.stepCount = Math.max(1, Math.round(value));
    }

    onChange(object);
  }

  document.querySelectorAll('[data-prop]').forEach((input) => {
    input.addEventListener('change', () => {
      applyPropertyChange(input);
    });
  });

  return { update };
}
