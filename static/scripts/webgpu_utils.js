async function get_webgpu_device(){
    if (!navigator.gpu){
        throw new Error("WebGPU not supported in this browser");
    }

    // https://gpuweb.github.io/gpuweb/#adapter-selection
    // The adapter is like a physical device. It corresponds to the
    // integrated or discrete GPU. It is the translation layer between
    // WebGPU and the machine's native API, i.e. Metal or Vulkan.
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter){
        throw new Error("No GPU found");
    }

    // https://gpuweb.github.io/gpuweb/#gpudevice
    // https://gpuweb.github.io/gpuweb/#gpudevicedescriptor
    // This is the logical device. This is the object that lets
    // the browser feel like it has full control over the GPU. 
    const device = await adapter.requestDevice();

    return device;
}

async function load_image_bitmap(url) {
    const res = await fetch(url);
    const blob = await res.blob();

    // colorSpaceConversion none ensures that the browser doesn't change the underlying
    // image's data. Necessary if the image is a normal map or other non-color data.
    return await createImageBitmap(blob, { colorSpaceConversion: 'none' });
}
