'use strict'

import SceneNode from "./scenenode.js"
import ObjectNode from "./object.js"
import Input from "./input.js"
import {PerspectiveCamera, OrthographicCamera} from "./camera.js"
import {PointLight, DirectionalLight} from "./light.js"
import Material from "./material.js"

/**
 * Clamps a number between two numbers
 * @param { Number } number The number to clamp
 * @param { Number } min The minimum used for clamping
 * @param { Number } max The maximum used for clamping
 * @returns { Number } The clamped number
 */
function clamp( number, min, max )
{

    return Math.max( min, Math.min( number, max ) )

}

/**
 * Converts degrees to radians
 * @param { Number } deg The number in degrees
 * @returns { Number }The angle in radians
 */
function deg2rad( deg )
{

    return ( deg * Math.PI ) / 180

}

/**
 * Converts a hex color string to a normalized rgba array
 * @param { String } hex The hex color as a string
 * @returns { Array<number> } The color as normalized values
 */
function hex2rgb( hex )
{

    let rgb = hex.match( /\w\w/g )
        .map( x => parseInt( x, 16 ) / 255 )
    return vec3.fromValues( rgb[ 0 ], rgb[ 1 ], rgb[ 2 ] )

}

/**
 * Converts a color vector to a hex color string
 * @param { Array.<Number> } rgb The color as normalized values
 * @returns { String } The hex color as a string
 */
function rgb2hex ( rgb )
{
    let hex = '#' + parseInt(rgb[0]*255).toString( 16 ).padStart(2,'0') + parseInt(rgb[1]*255).toString( 16 ).padStart(2,'0') + parseInt(rgb[2]*255).toString( 16 ).padStart(2,'0')
    return hex
}

/**
 * Returns the mouse coordinates relative to a clicking target, in our case the canvas
 * @param event The mouse click event
 * @returns { { x: number, y: number } } The x and y coordinates relative to the canvas
 */
 function getRelativeMousePosition( event )
 {
 
     let target = event.target
 
     // if the mouse is not over the canvas, return invalid values
     if ( target.id != 'canvas' )
     {
 
         return {
 
             x: Input.mousex,
             y: Input.mousey,
 
         }
 
     }
 
     target = target || event.target;
     let rect = target.getBoundingClientRect( );
 
     return {
 
         x: event.clientX - rect.left,
         y: event.clientY - rect.top,
 
     }
 
 }

/**
 * Loads a given URL; this is used to load the shaders from file
 * @param { String } url The relative url to the file to be loaded
 * @returns { String | null } The external file as text
 */
function loadExternalFile( url )
{
    let req = new XMLHttpRequest( )
    req.open( "GET", url, false )
    req.send( null )
    return ( req.status == 200 ) ? req.responseText : null

}

/**
 * Loads a given .obj file and builds an object from it with vertices, colors and normals
 * @param { String } url The url to the file
 * @param { Array.<Number> } fallback_color A default color to use if the OBJ does not define vertex colors
 * @returns { Array.<Number> } The complete, interleaved vertex buffer object containing vertices, colors and normals
 */
function loadObjFile( url, fallback_color )
{

    let raw = loadExternalFile( url )

    let vertices = [ ]
    let colors = [ ]
    let normals = [ ]
    let textures = [ ] 
    let vertex_ids = [ ]
    let normal_ids = [ ]
    let texture_ids = [ ]
    
    let mtl = null

    for ( let line of raw.split( '\n' ) )
    {

        switch ( line.split( ' ' )[ 0 ] )
        {

            case 'v':
                parseObjVertex( line, vertices )
                parseObjColor( line, colors, fallback_color )
                break
            case 'vn':
                parseObjNormal( line, normals )
                break
            case 'vt':
                parseObjTextures( line, textures )
                break
            case 'f':
                parseObjIds( line, vertex_ids, normal_ids, texture_ids )
                break
            case 'mtllib':
                let urlc = url.split('/')
                urlc.pop()
                mtl = urlc.join('/') + '/' + line.split( ' ' )[ 1 ]

        }
    }
    
    let vertex_normal_map = {}
    for (let i = 0; i < vertex_ids.length; i++) {
        if (!(vertex_ids[i] in vertex_normal_map))
            vertex_normal_map[vertex_ids[i]] = []
        
        vertex_normal_map[vertex_ids[i]].push(normal_ids[i])
    }

    for (let vertex_id in vertex_normal_map) {
        let normal = averageNormals(vertex_normal_map[vertex_id], normals)

        vertex_normal_map[vertex_id] = normal
    }

    const newVertices = []
    for (let i = 0; i < vertex_ids.length; i++) {
        const vid = ( vertex_ids[ i ] * 3 )
        newVertices.push(vertices[ vid ], vertices[ vid + 1 ], vertices[ vid + 2 ])
    }

    const newTextures = []
    for (let i = 0; i < texture_ids.length; i++) {
        const tid = ( texture_ids[ i ] * 2 )
        newTextures.push(textures[ tid ], textures[ tid + 1 ])
    }

    let [ tangents, bitangents ] = calculateTangentSpace(newVertices, newTextures);

    let data = [ ]
    for ( let i = 0; i < vertex_ids.length; i++ )
    {

        const vid = ( vertex_ids[ i ] * 3 )
        const nid = ( normal_ids[ i ] * 3 )
        const tid = ( texture_ids[ i ] * 2 )
        const tangi = i * 3
        const normal = vertex_normal_map[vertex_ids[i]]

        // Data is now considered to be 
        // Keep it every three values 
        // x,y,z 
        // r,g,b 
        // n0, n1, n2
        // avgN0, avgN1, avgN2,
        // vt1, vt2
        // tang0, tang1, tang2 
        // bitang1, bitang2, bitang3 
        data.push( vertices[ vid ], vertices[ vid + 1 ], vertices[ vid + 2 ] )
        data.push( colors[ vid ], colors[ vid + 1 ], colors[ vid + 2 ] )
        data.push( normals[ nid ], normals[ nid + 1 ], normals[ nid + 2 ] )
        data.push( normal[0], normal[1], normal[2] )
        data.push( textures[ tid ], textures[ tid + 1 ] )
        data.push( tangents[ tangi ], tangents[ tangi+ 1 ], tangents[ tangi + 2 ])
        data.push( bitangents[ tangi ], bitangents[ tangi + 1 ], bitangents[ tangi + 2 ])
    }
    return [ data, mtl ]

}

/**
 * Averages a number of normals given their ids and a full list of normals
 * @param { Array.<Number> } ids The normal ids that need to be averaged
 * @param { Array.<Number> } normals The list of all normals
 * @returns 
 */
function averageNormals(ids, normals) {

    let avg = [0, 0, 0]
    for (let id of ids) {
        const nid = id*3
        avg[0] += normals[nid]
        avg[1] += normals[nid+1]
        avg[2] += normals[nid+2]
    }

    avg[0] /= ids.length
    avg[1] /= ids.length
    avg[2] /= ids.length

    return avg
}

/**
 * Parses a given object vertex entry line
 * @param { String } entry A line of an object vertex entry
 * @param { Array.<Number> } list The list to write the parsed vertex coordinates to
 */
function parseObjVertex( entry, list )
{

    const elements = entry.split( ' ' )
    if ( elements.length < 4 )
        alert( "Unknown vertex entry " + entry )

    list.push( parseFloat( elements[ 1 ] ), parseFloat( elements[ 2 ] ), parseFloat( elements[ 3 ] ) )

}

/**
 * Parses a given object color entry line
 * @param { String } entry A line of an object color entry
 * @param { Array.<Number> } list The list to write the parsed vertex colors to
 * @param { Array.<Number> } fallback_color A fallback color in case the OBJ does not define vertex colors
 */
function parseObjColor( entry, list, fallback_color )
{

    const elements = entry.split( ' ' )
    if ( elements.length < 7 )
    {

        list.push( fallback_color[ 0 ], fallback_color[ 1 ], fallback_color[ 2 ] )
        return

    }

    list.push( parseFloat( elements[ 4 ] ), parseFloat( elements[ 5 ] ), parseFloat( elements[ 6 ] ) )

}

/**
 * Parses a given object normal entry line
 * @param { String } entry A line of an object normal entry
 * @param { Array.<Number> } list The list to write the parsed vertex normals to
 */
function parseObjNormal( entry, list )
{

    const elements = entry.split( ' ' )
    if ( elements.length != 4 )
        alert( "Unknown normals entry " + entry )

    list.push( parseFloat( elements[ 1 ] ), parseFloat( elements[ 2 ] ), parseFloat( elements[ 3 ] ) )

}

/**
 * Parses a given object normal entry line
 * @param { String } entry A line of an object texture coordinate entries
 * @param { Array.<Number> } list The list to write the parsed texture coordinates to
 */
 function parseObjTextures( entry, list )
 {
 
     const elements = entry.split( ' ' )
     if ( elements.length != 3 )
         alert( "Unknown texture entry " + entry )

     let newY = parseFloat( elements[ 2 ] )

     newY = 1 - newY
     
     list.push( parseFloat( elements[ 1 ] ), newY)
 
 }

/**
 * Parses a given object ids entry line
 * @param { String } entry A line of an object ids entry
 * @param { Array.<Number> } vertex_ids The list of vertex ids to write to
 * @param { Array.<Number> } normal_ids The list normal ids to write to
 */
function parseObjIds( entry, vertex_ids, normal_ids, texture_ids )
{

    const elements = entry.split( ' ' )
    if ( elements.length != 4 )
        alert( "Unknown face entry " + entry )

    for ( let element of elements )
    {

        if ( element == 'f' )
            continue

        const subelements = element.split( '/' )

        vertex_ids.push( parseInt( subelements[ 0 ] ) - 1 )
        texture_ids.push( parseInt( subelements[ 1 ] ) - 1 )
        normal_ids.push( parseInt( subelements[ 2 ] ) - 1 )

    }

}

function loadMtlFile ( url ) {
    if (url == null)
        return new Material()

    let raw = loadExternalFile( url )

    let ka = [0.5, 0.5, 0.5]
    let kd = [0.5, 0.5, 0.5]
    let ks = [0.2, 0.2, 0.2]
    let alpha = 12

    for ( let line of raw.split( '\n' ) )
    {
        let values = line.split( ' ' )

        switch ( values[ 0 ] )
        {

            case 'Ka':
                ka = vec3.fromValues(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]))
                break
            case 'Kd':
                kd = vec3.fromValues(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]))
                break
            case 'Ks':
                ks = vec3.fromValues(parseFloat(values[1]), parseFloat(values[2]), parseFloat(values[3]))
                break
            case 'Ns':
                alpha = parseFloat(values[1])

        }
    }

    return new Material(ka, kd, ks, alpha)
}

/**
 * Loads a scene file and triggers the appropriate parsing functions
 * @param { String } url The url to the scene file
 * @returns An object containing information about the camera, the light and the scene
 */
function loadSceneFile( url )
{

    let raw = loadExternalFile( url )

    let scene_description = JSON.parse( raw )
    let camera = parseCamera( scene_description[ "camera" ] )
    let root = new SceneNode( "root", null )
    let scene = parseSceneNode( scene_description[ "root" ], root )
    let lights = parseLights( scene_description[ "lights" ], root )
    root.children.push(scene)        
    root.children.push(...lights.point_lights)
    root.children.push(...lights.directional_lights)

    return {
        "camera": camera,
        "scene": root,
        "lights": lights
    }
}

/**
 * Parses a given camera entry
 * @param { TODO } entry An entry containing information on a single camera
 * @returns A camera instance with the camera read from the scene file
 */
function parseCamera( entry )
{

    let camera = null

    let position = vec3.fromValues( entry.position[ 0 ], entry.position[ 1 ], entry.position[ 2 ] )
    let lookat = vec3.fromValues( entry.lookat[ 0 ], entry.lookat[ 1 ], entry.lookat[ 2 ] )
    let up = vec3.fromValues( entry.up[ 0 ], entry.up[ 1 ], entry.up[ 2 ] )
    let fov = entry.fov

    if ( entry.type == "perspective" )
    {

        camera = new PerspectiveCamera( position, lookat, up, fov )

    }
    else if ( entry.type == "orthographic" )
    {

        camera = new OrthographicCamera( position, lookat, up, fov )

    }

    return camera

}

/**
 * Parse all the Lights in the scene
 * @param { Object } entry An entry from the JSON config representing the lights in a scene
 * @param { Object } parent The scene node which parents all light sources (usually the root)
 */
function parseLights( entry, parent )
{
    let lights = {}

    lights['ambient'] = entry.ambient
    
    lights['point_lights'] = []
    for (let pointlight of entry.point_lights) {
        lights['point_lights'].push(new PointLight(
            pointlight.position,
            pointlight.Id,
            pointlight.Is,
            pointlight.k,
            parent
        ))
    }

    lights['directional_lights'] = []
    for (let directionallight of entry.directional_lights) {
        lights['directional_lights'].push(new DirectionalLight(
            directionallight.direction,
            directionallight.Id,
            directionallight.Is,
            parent
        ))
    }

    return lights
}


/**
 *  Recursively parses a SceneNode and its children
 * @param { Object } entry An entry from the JSON config representing a SceneNode
 * @param { Object | null } parent The parent node of the current SceneNode
 * @returns { SceneNode } The parsed SceneNode object
 */
function parseSceneNode( entry, parent )
{

    let node = null

    let name = entry.name
    let translation = vec3.fromValues( entry.translation[ 0 ], entry.translation[ 1 ], entry.translation[ 2 ] )
    let rotation = vec3.fromValues( entry.rotation[ 0 ], entry.rotation[ 1 ], entry.rotation[ 2 ] )
    let scale = vec3.fromValues( entry.scale[ 0 ], entry.scale[ 1 ], entry.scale[ 2 ] )
    let textImage = entry.texture
    let normImage = entry.normal 
    if ( entry.type == 'node' )
    {
        node = new SceneNode( name, parent, translation, rotation, scale )

    }
    else if ( entry.type == 'object' )
    {

        const fallback_color = hex2rgb( entry.color )
        const [obj_content, mtl] = loadObjFile( entry.obj, fallback_color )
        const obj_material = loadMtlFile( mtl )

        // Hard coding if there is any vertex coordinates 
        // If there isn't any vt, then we assume there is no texture to map it to
        if (obj_content[12] == null) {
            textImage = null 
        }        
        node = new ObjectNode( obj_content, name, parent, translation, rotation, scale, obj_material, textImage, normImage )
        console.log(node)
    }

    for ( let child of entry.children )
        node.children.push( parseSceneNode( child, node ) )

    return node

}


// Functions copied from mozilla to load an image to texture
// Function similar to function from observable notebook  
// Takes an image source and applies it to a texture map 
function loadTexture(gl, url) {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
  
    // Because images have to be downloaded over the internet
    // they might take a moment until they are ready.
    // Until then put a single pixel in the texture so we can
    // use it immediately. When the image has finished downloading
    // we'll update the texture with the contents of the image.
    const level = 0;
    const internalFormat = gl.RGBA;
    const width = 1;
    const height = 1;
    const border = 0;
    const srcFormat = gl.RGBA;
    const srcType = gl.UNSIGNED_BYTE;
    const pixel = new Uint8Array([0, 0, 255, 255]);  // opaque blue
    gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                  width, height, border, srcFormat, srcType,
                  pixel);
  
    const image = new Image();
    image.onload = function() {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, level, internalFormat,
                    srcFormat, srcType, image);
  
      // WebGL1 has different requirements for power of 2 images
      // vs non power of 2 images so check if the image is a
      // power of 2 in both dimensions.
      if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
         // Yes, it's a power of 2. Generate mips.
         gl.generateMipmap(gl.TEXTURE_2D);
      } else {
         // No, it's not a power of 2. Turn off mips and set
         // wrapping to clamp to edge
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
         gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      }
    };
    image.src = url;
  
    return texture;
  }

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

// Source: From observable ECS 175 notebook 
function calculateTangentSpace (vertices, uvs) {
    {

        let tangents = []
        let bitangents = []
        
        for (let i = 0; i < vertices.length/3; i += 3) {
          let idxv = i*3
          let idxuv = i*2
          
          let v0 = vec3.fromValues(vertices[idxv], vertices[idxv+1], vertices[idxv+2])
          let v1 = vec3.fromValues(vertices[idxv+3], vertices[idxv+4], vertices[idxv+5])
          let v2 = vec3.fromValues(vertices[idxv+6], vertices[idxv+7], vertices[idxv+8])
          //console.log("V", v0, v1, v2)
      
          let uv0 = vec2.fromValues(uvs[idxuv], uvs[idxuv+1])
          let uv1 = vec2.fromValues(uvs[idxuv+2], uvs[idxuv+3])
          let uv2 = vec2.fromValues(uvs[idxuv+4], uvs[idxuv+5])
          //console.log("UV", uv0, uv1, uv2)
      
          let dv1 = vec3.sub(vec3.create(), v1, v0);
          let dv2 = vec3.sub(vec3.create(), v2, v0);
          //console.log("DV", dv1, dv2)
      
          let duv1 = vec2.sub(vec3.create(), uv1, uv0);
          let duv2 = vec2.sub(vec3.create(), uv2, uv0);
          //console.log("DUV", duv1, duv2)
      
          let r = 1.0 / (duv1[0] * duv2[1] - duv1[1] * duv2[0])
          //console.log("R", r)
          let tangent = vec3.scale(vec3.create(), 
                                        vec3.sub(vec3.create(), 
                                           vec3.scale(vec3.create(), dv1, duv2[1]),
                                           vec3.scale(vec3.create(), dv2, duv1[1]), 
                                        ), r)
          //console.log("TAN", tangent)
          
          let bitangent = vec3.scale(vec3.create(), 
                                        vec3.sub(vec3.create(), 
                                           vec3.scale(vec3.create(), dv2, duv1[0]),
                                           vec3.scale(vec3.create(), dv1, duv2[0]), 
                                        ), r)
      
          //console.log("BITAN", bitangent)
      
          for (let j = 0; j < 3; j++) {
            tangents.push(tangent[0])
            tangents.push(tangent[1])
            tangents.push(tangent[2])
            bitangents.push(bitangent[0])
            bitangents.push(bitangent[1])
            bitangents.push(bitangent[2])
          }
        }
      
        return [tangents, bitangents]
      }
}


// Need to create a function to parse the vertex textures 
// Need to create a case where there are no texture coordinates, make them null? 
export
{

    clamp,
    deg2rad,
    hex2rgb,
    rgb2hex,
    getRelativeMousePosition,
    loadExternalFile,
    loadObjFile,
    loadMtlFile,
    loadSceneFile,
    loadTexture

}
