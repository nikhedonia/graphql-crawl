# graphql-crawl
graphql-backend for fetching and extracting data from websites using css

## How to start?

```
babel-node index
```

Then head over to `localhost:4000/graphql` to open the graphql playground.
The Schema should give you an idea what you can do.


### Example query:

```graphql
query {
  paginate(
    url: "https://news.ycombinator.com" 
    sel: "a.morelink",
    count: 2) {
    url
    css(sel: "a.storylink", start: 0, end: 30) {
      title: follow {
        url
        css(sel: "h1") {
          text
        }
      }
    }
  }
}
```
