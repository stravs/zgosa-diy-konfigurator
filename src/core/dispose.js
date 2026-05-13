export function disposeObject3D(object3d) {
  object3d.traverse((child) => {
    if (child.geometry) {
      child.geometry.dispose();
    }
  });
}
