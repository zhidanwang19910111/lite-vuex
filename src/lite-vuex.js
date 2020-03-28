// 将 Vuex 挂载到window下面
(function (global, factory) {
  global.Vuex = factory()
})(this, (function() {

  // # 一、为 每一个组件挂载  $store

    // ** 1. vuex 会挂载一个 vm.$store 全局属性， 取值的时候可以 通过 $store.state ...
      // 接下来我们看store是怎么塞入到 vue中的   Vue.use(vuex) -- 用来写插件，Vue.use()用来安装这个插件
      // ,第一个参数是  Vue的构造函数, 第二个是传入的options
      // 如果传入对象 默认调用这个库的install方法  https://cn.vuejs.org/v2/guide/plugins.html
      // https://github.com/vuejs/awesome-vue#components--libraries 丰富的插件社区

    // ** 2. 先保留一份  Vue 
    // ** 3. 初始化store 的时候  new Vux.store() 所有  Vuex应该还有一个   store的构造函数,
      //  而且我们想在所有组件中都可以访问到  $store, 就要给每一个组件都添加 $store属性 vue中提供了  一个方法 vue.mixin()
      // 它将影响每一个之后创建的 Vue 实例, 通过这个方法我们可以给所有的组件都添加上一个  $store, 
      // 通过这个方法我们可以看出来，vue是先渲染父组件再渲染子组件， 深度优先
  var Vue
  function forEach (obj, callback) {
    Object.keys(obj).forEach(function(key) {
      callback && callback(key, obj[key])
    })
  }
  var install = function(_Vue) {
    Vue = _Vue

    Vue.mixin({
      beforeCreate: function() {
        // 深度优先，判断父组件是否有 $store,如果有 就把父级的 赋值给  组件的 $store
        if( this.$options && this.$options.store ) {
          this.$store = this.$options.store
        }else{
          this.$store = this.$parent && this.$parent.$store
        }
      }
    })
  }

  var Store = function( options ) {
    // # 二、处理  store的  state, 我们不能直接修改 ，所有我们用es5写一个  get 和 set 方法封装 this._state
    // 理论上给 this.$store.state[xxx]属性赋值是不合法的，但是真实可以成功，而且得响应式的
    this._state = new Vue({
      data: {
        state: options.state
      }
    })
    Object.defineProperty( this, 'state', {
      enumerable: true,
      configurable: true,
      get() {
        return this._state.state
      },
      set() {
        {
          throw new Error(("[vuex] " + '不能通过 state 直接赋值，可以通过  commit 触发'))
        }
      }
    })
    // # 三、处理  store的  getters, (相当于 vue的 computed的属性)
    this.getters = {}
    this.mutations = {}
    this.actions = {}

    // actions commit 的时候  this是 window ，所以会找不到 触发的 commit函数名， 解决办法就是 先定义一个commit 和  dispatch
    var commit = this.commit, dispatch = this.dispatch
    this.commit = function(type, payload) {
      commit.call(this, type, payload )
    }.bind(this)
    this.dispatch = function(type, payload) {
      dispatch.call(this, type, payload)
    }.bind(this)

    // 六 为 store 添加  mudules, 需要先格式化一下当前的用户传递过来的数据, 分为两个部分，收集模块 和 安装模块
    // 所以上面写的 state, getters, mutations, actions, 都可以通过  安装模块的方法写入
    // 收集模块
    this.modules = new ModuleCollection( options )
    console.log(this.modules)
    // 安装模块
    installModule(this, this.state, [], this.modules.root)
    
  }
  // 同步提交
  Store.prototype.commit = function(type, payload) {
    this.mutations[type].forEach( function(item) {
      item(payload)
    } )
  }
  // 异步提交
  Store.prototype.dispatch = function(type, payload) {
    this.actions[type].forEach( function(item) {
      item(payload)
    })
  }
  // 收集模块
  function ModuleCollection( rootModule ) {
    this.register([], rootModule)
  }
  ModuleCollection.prototype.register = function( path, rootModule ) {
    let newModule = {
      _raw: rootModule,
      _children: {},
      state: rootModule.state
    }
    
    if( path.length === 0 ) {
      this.root = newModule
    }else {
      let parent = path.slice(0, -1).reduce( function(root, cur) {
        return root._children[ cur ]
      }, this.root)
      parent._children[path[ path.length - 1 ]] = newModule
    }
    if( rootModule.modules ) {
      forEach( rootModule.modules, function( moduleName, module ) {
        this.register( path.concat(moduleName), module )
      }.bind(this))
    }
  }
  // 安装模块
  function installModule( store, state, path, rootModule ) {
    // 安装模块的  state
    if( path.length > 0 ) {
      let parent = path.slice(0, -1).reduce(function(state, cur) {
        return state[cur]
      }, state)
      Vue.set(parent, path[path.length - 1], rootModule.state )
    }
    // 需要递归 将结果挂载 getters, mutations, actions
    var getters = rootModule._raw.getters
    if( getters ) { // 给 store 增加了getters 属性
      forEach(getters, function(key, value) {
        Object.defineProperty(store.getters, key, {
          enumerable: true,
          configurable: true,
          get: function() {
            return value( rootModule.state )
          }
        })
      })
    }
    // 处理mutations
    var mutations = rootModule._raw.mutations
    if( mutations ) {
      forEach(mutations, function(key, value) {
        store.mutations[key] = store.mutations[key] || []
        store.mutations[key].push(function(payload) {
          value(rootModule.state, payload )
        })
      })
    }
    // 处理actions
    var actions = rootModule._raw.actions
    if( actions ) {
      forEach( actions, function(key, value) {
        store.actions[key] = store.actions[key] || []
        store.actions[key].push( function(payload) {
          value(store, payload)
        })
      })
    }
    if( rootModule._children ) {
      forEach( rootModule._children, function(moduleName, module) {
        installModule( store, state, path.concat(moduleName), module )
      })
    }
    
  }
  return {
    install: install,
    Store: Store
  }
}))

// namespace  命名空间
// registerModules  如何动态注册模块
// store.subscribe()  中间件


