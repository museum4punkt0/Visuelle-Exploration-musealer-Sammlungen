import { writable, derived, readable, get } from 'svelte/store';
import { scaleLinear } from "d3-scale";
import { extent } from "d3-array";
import { csv, json } from "d3-fetch";
import { Sprite, Texture, Container, Renderer } from "pixi.js";
import Fuse from 'fuse.js'

console.log("STORE INIT")

export const margin = { top: 20, right: 20, bottom: 20, left: 20 };

export const renderer = writable()

export const searchstring = writable("")

export const container = writable()

export const divContainer = writable()

// export const container = readable(null, set => {
//     const c = new Container()
//     c.sortableChildren = true
//     set(c)

//     return () => c.destroy()
// })

export const umapData = readable([], set => {
    csv("data/umap.csv", ({ id, x, y }) => ({
        id,
        x: +x,
        y: +y,
    })).then(set)
});

export const detailData = readable(new Map(), set => {
    csv("data/export1305-bitlabels.csv").then(data => set(new Map(data.map(d => [d.id, d]))))
});

export const sprites = derived(umapData, $data => {
    console.log("sprites creation")
    const sprites = new Map()
    for (const d of $data) {
        const sprite = new Sprite(Texture.WHITE)
        sprite.scale.x = sprite.scale.y = 0.5
        sprite.anchor.set(0.5);
        sprites.set(d.id, sprite)
    }
    return sprites
})

export const history = writable([])

export const darkmode = writable(false)

export const state = writable("cloud")

export const lastTransformed = writable({ k: 1, x: 0, y: 0 })

export const mouse = writable([0, 0])

export const anchor = writable()

export const selectedItem = writable(undefined)

export const dimensions = writable({ width: 500, height: 500 });

export const scales = derived(
    [dimensions, umapData],
    ([$dimensions, $umapData]) => {

        return {
            x: scaleLinear()
                .nice()
                .range([margin.left, $dimensions.width - margin.right])
                .domain(extent($umapData, (d) => d.x)),
            y: scaleLinear()
                .nice()
                .range([$dimensions.height - margin.bottom, margin.top])
                .domain(extent($umapData, (d) => d.y))
        }
    }
);

export const spriteScale = derived(
    [dimensions, umapData],
    ([$dimensions, $umapData]) => (Math.sqrt(($dimensions.width * $dimensions.height) / $umapData.length) /
        400)
);

export const fuseIndex = derived(
    [detailData],
    ([$detailData]) => {
        const list = Array.from($detailData.values())
        const keys = ["id","_idlong","_sammlung","_idnr","_titel","keywords","_actors","_ort","_datum","_material","_abmessung","_beschreibung","year","_stichwort"]
        console.time("create fuse index")
        const index = Fuse.createIndex(keys, list)
        console.timeEnd("create fuse index")
        return new Fuse(list, { keys, threshold: 0.4 }, index)
    }
);

export const fuseSearch = derived(
    [fuseIndex, searchstring, detailData],
    ([$fuseIndex, $searchstring, $detailData]) => {
        if($searchstring === ""){
            return Array.from($detailData.values()).map(d => d.id)
        } else {
            console.time("search")
            const items = $fuseIndex.search($searchstring)
            console.timeEnd("search")
            return items.map(d => d.item.id)
        }
    }
);

// export const searchItems = derived(
//     [detailData, searchstring],
//     ([$detailData, $searchstring]) => {
//         let items = Array.from($detailData.values())
//         if($searchstring != ""){
//             items = items.filter(d => d._titel.indexOf($searchstring) > -1)
//         }
//         // console.log($searchstring, items)
//         return items.map(d => d.id)
//     }
// );


export const umapProjection = derived(
    [umapData, spriteScale, scales, fuseSearch],
    ([$umapData, $spriteScale, $scales, $searchItems]) => ($umapData
        .map(d => ({
            id: d.id,
            x: $scales.x(d.x),
            y: $scales.y(d.y),
            scale: $spriteScale,
            alpha: 1,
            zIndex: 0,
            visible: $searchItems.includes(d.id),
        })))
);

export const distancesCutoffScore = writable(30)

export const distances = readable(new Map(), set => {
    json("data/pca-titel-bild-embeds.json")
        .then(data =>
            set(new Map(data.map(d => [d.id, d])))
        )
});
export const selectedDistances = derived(
    [selectedItem, distances, distancesCutoffScore],
    ([$item, $distances, $score]) => {
        // console.log($item, $distances, $score)
        if (!$item || !$distances.size) { return [] }
        else {
            return $distances.get($item.id).distances.filter((d) => d[1] > $score)
        }
    })

export const getSelectedDistances = derived(
    [distances, distancesCutoffScore],
    ([$distances, $score]) => {
        return (id) => {
            if (!$distances.size) { return [] }
            else {
                return $distances.get(id).distances.filter((d) => d[1] > $score)
            }
        }
    })
