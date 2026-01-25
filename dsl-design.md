## 简介

这篇文档主要描述 reqcraft 的DSL 设计

## 结构

### 基础结构

```
config {
  baseUrl http://example.com
}

api /user/info {
  get {
    request {}
    
    response {
      username String // this is a comment
      age Number
      info {
        foo String
        bar String
      }?
    }
  }
}
```

> 其中 `?` 表示这是一个 optional 参数

### import

允许引入openapi, 用于渐进式迁移

```
import "./openapi.yaml"
```

也支持json格式
```
import "./openapi.json"
```

支持从远程URL获取OpenAPI文件
```
import "https://example.com/api/openapi.json"
```

如果后缀是 `.rqc` 格式，也可以引入，会拼接在一起

```
import "./user.rqc"
```

### Mock 请求

允许进行mock请求操作

如果终端使用 `rqc dev --mock` 方式运行程序，则视为启动了mock模式

mock模式下所有的请求都发往终端，如果在rqc有配置mock则直接返回mock的值，如果没有则做简单转发

mock 配置示例如下:

```
api /user/info {
  get {
    request {}
    
    response {
      username String @mock("elon musk")
      age Number @mock(20)
      info {
        foo String @mock("any things")
        bar String
      }?
    }
  }
}
```

### 请求示例

api的request中允许使用example描述符来给输入参数增加一个默认值。如果没有example则使用空值(字符串为空字符串，数字类型为0)

同时，他会作为输入参数的默认值。(默认使用空值，如果用户点击按钮则载入示例)

示例:

```
api /user/profile {
  post {
    request {
      name String @example("Elon Musk")
      age Number
    }
    
    response { ... }
  }
}
```

同时也支持params类型的请求参数，如果有 @params 标识，则视为url query string params

示例: 

```
api /user/profile {
  post {
    request {
      name String @example("Elon Musk")
      age Number @params
    }

    response { ... }
  }
}
```

### 接口命名

支持接口命名, 并会在web ui中展示

```
api /user/info {
  get {
    name "Get User Info"
    
    request {}
    
    response {
      username String // this is a comment
      age Number
      info {
        foo String
        bar String
      }?
    }
  }
}
```


### 接口注释

支持接口，字段注释，支持多行和单行注释, 并会在web ui中展示

```
api /user/info {
  /**
   * get user info from remote
   */
  get {
    request {}
    
    response {
      username String // this is a comment
    }
  }
}
```

### 多 baseUrl 模式

在 config > baseUrl 字段，可以选择多个baseUrl。在web ui 中可以手动切换，以实现对不同url进行测试

```
config {
  baseUrl http://example1.com,http://example2.com
}
```

### 全局变量

在 config 中可以定义全局变量，这些变量可以在 URL、Headers、Params、Body 等位置使用 `{variableName}` 语法进行引用。

定义变量（类型可选，默认为 String）:
```
config {
  variable workspaceId
  variable apiVersion
}
```

也可以显式指定类型:
```
config {
  variable workspaceId String
  variable count Number
}
```

定义变量（有默认值）:
```
config {
  variable workspaceId default("my-workspace")
  variable apiVersion String default("v1")
}
```

使用变量:
```
api /workspace/{workspaceId}/users {
  get {
    request {
      version String @example("{apiVersion}")
    }
    response { ... }
  }
}
```

变量在 Web UI 中可以通过侧边栏的 "Variables" 入口进行管理和编辑。配置文件中定义的变量会显示 `from .rqc` 标签，名称不可编辑但值可以覆盖。用户也可以添加自定义变量。

### 全局请求头

在 config 中可以定义全局请求头，这些请求头会自动添加到所有 API 请求中。

定义请求头（无默认值）:
```
config {
  header Authorization
  header X-API-Key
}
```

定义请求头（有默认值）:
```
config {
  header Authorization @default("Bearer your-token")
  header X-API-Key @default("your-api-key")
}
```

请求头的值也支持变量语法:
```
config {
  variable token String default("my-token")
  header Authorization @default("Bearer {token}")
}
```

全局请求头在 Web UI 中可以通过 "Variables" 页面的 "Global Headers" 部分进行管理。配置的请求头会自动添加到所有请求中，请求级别的 Headers 可以覆盖全局请求头。

### CORS 代理模式

当开发时遇到跨域问题，可以开启 CORS 代理模式。开启后，所有请求会通过本地服务器转发，绕过浏览器的 CORS 限制。

通过命令行启用:
```bash
rqc dev --cors
```

或者在配置文件中启用:
```
config {
  cors true
}
```

### Mock 模式配置

除了通过命令行 `rqc dev --mock` 启用 mock 模式外，也可以在配置文件中启用:

```
config {
  mock true
}
```

命令行参数和配置文件可以同时使用，只要任一方开启，对应功能就会生效。

### CORS 代理模式

当开发环境遇到 CORS 跨域问题时，可以开启 CORS 代理模式。开启后所有请求会通过本地服务器转发，从而绕过浏览器的 CORS 限制。

可以通过命令行参数开启：
```bash
rqc dev --cors
```

也可以在配置文件中开启：
```
config {
  cors true
}
```

### Mock 模式配置

除了通过命令行 `--mock` 参数开启 Mock 模式外，也可以在配置文件中开启：

```
config {
  mock true
}
```

命令行参数和配置文件设置可以同时使用，只要有一个为 true 即生效。

### Category 分类

DSL 中可以对api scope使用 `category` 进行分类。包含name desc prefix 关键字来进一步描述category信息。这些字段都是可选的

比如

```
category user {
  name "User"
  desc "User Info"
  
  api /user/info { ... }
  api /user/profile { ... }
}
```

如果也可以使用prefix字段来简化后续的 api url描述

如:
```
category user {
  prefix "/user"
  
  api /info { ... }
  api /profile { ... }
}
```

同时category也可以进行嵌套。比如:

```
category a {
  category b {
    category c {
      ...
    }
  }
}
```

### Websocket 支持

同时支持websocket 事件，格式参考

```
ws https://echo.websocket.org/ {
  event foo {
    request {
      foo String
      bar Number
    }
    
    response {
      foo String
      bar Number
    }
  }
  
  event bar { }
}
```
