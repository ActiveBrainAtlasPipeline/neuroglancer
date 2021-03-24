import {WatchableCoordinateSpaceTransform} from 'neuroglancer/coordinate_transform';
import {StatusMessage} from 'neuroglancer/status';
import {RefCounted} from 'neuroglancer/util/disposable';
import {removeFromParent} from 'neuroglancer/util/dom';
import {fetchOk} from 'neuroglancer/util/http_request';
import {dimensionTransform} from 'neuroglancer/util/matrix';
import {makeIcon} from 'neuroglancer/widget/icon';
import {AppSettings} from 'neuroglancer/services/service';

const rotationMatrixURL = `${AppSettings.API_ENDPOINT}/alignatlas?animal=`;
const pattern_animal = /precomputed:\/\/https:\/\/activebrainatlas.ucsd.edu\/data\/([A-Z0-9]+)\//g;
const buttonText = 'Fetch rotation matrix for this layer';
const buttonTitle = 'Please note that the rotation matrix will only be applied for the current layer. To rotate other layers, switch to that layer and click this button.';

interface remoteRotationMatrix {
  rotation: Array<Array<any>>;
  translation: Array<Array<any>>;
}

export class FetchRotationMatrixWidget extends RefCounted{
  element: HTMLElement;
  animal: string|null;

  constructor(public transform: WatchableCoordinateSpaceTransform, private url: string) {
    super();
    this.transform = transform;
    this.url = url;
    this.animal = null;

    const animals = [...this.url.matchAll(pattern_animal)];
    const animalNames = [...new Set(animals.map(m => m[1]))];
    if (animalNames.length === 1) {
      this.animal = animalNames[0];
      this.element = makeIcon({
        text: buttonText,
        title: buttonTitle,
        onClick: () => {this.fetchRotationMatrix()},
      });
      this.registerDisposer(() => removeFromParent(this.element));
    }
  };

  isAnimal(): boolean {
    return this.animal !== null;
  }

  async fetchRotationMatrix() {
    StatusMessage.showTemporaryMessage('Fetching rotation matrix for ' + this.animal);

    try {
      const rotationJSON:remoteRotationMatrix = await fetchOk(rotationMatrixURL + this.animal, {
        method: 'GET',
      }).then(response => {
        return response.json();
      })
      const {rotation, translation} = rotationJSON;

      const rank = this.transform.value.rank;
      const newTransform = Float64Array.from([
        rotation[0][0], rotation[1][0], rotation[2][0], 0,
        rotation[0][1], rotation[1][1], rotation[2][1], 0,
        rotation[0][2], rotation[1][2], rotation[2][2], 0,
        translation[0][0], translation[1][0], translation[2][0], 1,
      ])
      this.transform.transform = dimensionTransform(newTransform, rank);
      StatusMessage.showTemporaryMessage('Fetched rotation matrix for ' + this.animal);
    } catch (e) {
      StatusMessage.showTemporaryMessage('Unable to get rotation matirx.');
      throw e;
    }
  }
}