window.config={
    a:6,
    ...window?.customConfig||{},
    ...window?.config?.plugin||{}
}