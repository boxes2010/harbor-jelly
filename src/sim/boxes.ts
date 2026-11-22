import * as THREE from 'three/webgpu'
import { BOX_GEO, LIVERIES, mat } from '../kit'
import { FINISH } from '../style'

export class BoxPool {
  private free: THREE.Mesh[] = []

  get(color: number): THREE.Mesh {
    const mesh = this.free.pop() ?? new THREE.Mesh(BOX_GEO)
    mesh.material = mat(LIVERIES[color], FINISH.paint)
    mesh.userData.color = color
    mesh.userData.cargo = undefined
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.quaternion.identity()
    return mesh
  }

  release(mesh: THREE.Mesh): void {
    mesh.removeFromParent()
    this.free.push(mesh)
  }
}
