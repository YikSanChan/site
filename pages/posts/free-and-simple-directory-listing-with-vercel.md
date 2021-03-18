---
title: Free and simple Directory Listing with Vercel
date: 2021/01/26
description: How to serve your directories on the web with Vercel, and why.
tag: web, guide
author: Yik San Chan
---

# Free and simple Directory Listing with Vercel

## What is directory listing, and why

Directories provide a natural way of organizing files. For example, in order to store course materials (mostly PDF) from 2 open courses in my local filesystem, I organize them using the directory hierarchy as shown below.

![Local listing](/images/free-and-simple-directory-listing-with-vercel/local-listing.png)

What if we want to host the directory on the web for easier access and reference? Say you are away from your laptop but want to check the course materials real quick on your phone, or you are writing a blog post and want to reference some lecture slides using a URL.

Directory listing comes to the rescue. Basically, it allows you to put your directories on the web, and grants you access to your files via some URLs. At the end of the post, you will be able to use the URL [https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020](https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020) to browse your directory like this:

![Vercel listing](/images/free-and-simple-directory-listing-with-vercel/vercel-listing.png)

## Directory listing solutions

There are multiple ways of doing this. I will comment on each of them based on these criteria:

- Free.
- Simple.
- URL friendly: Directories and files are accessible via reasonable and even customizable URLs.
- Browsable: PDF files can be viewed without the need to download.

### File storage service: Google Drive and friends

Google Drive, Dropbox, AliyunDrive (阿里云盘) are popular file storage services that focus on UI (compared to API) users. After uploading your directory to the cloud, you can easily turn the resource into a publicly accessible URL. Note that it usually comes with built-in access control so that you can choose to share the resources with only a certain group of people.

![GDrive get link](/images/free-and-simple-directory-listing-with-vercel/gdrive-get-link.png)

Users with the URL and the right permission can access your directory on the web,

![GDrive listing](/images/free-and-simple-directory-listing-with-vercel/gdrive-listing.png)

preview or download the PDF.

![GDrive preview](/images/free-and-simple-directory-listing-with-vercel/gdrive-preview.png)

According to our criteria:

- Free (✅).
- Simple (✅): To everyone.
- URL friendly (❌): Directories are accessible via URLs, but files are not. You have to click on a certain file, and Google Drive gives you a preview. Besides, the URL doesn't make much sense, impossible to remember, and impossible to customize.
- Browsable (〰️): It allows in-browser view, but the experience is not as good as opening a PDF file in a browser.

### Code hosting service: GitHub and friends

GitHub and GitLab host and version-control your code, but people do sometimes store non-code content (including PDF files) on the sites. Sharing the files to the public is nothing more than pushing your files to a public repository. An example can be found at [https://github.com/YikSanChan/fileserve/blob/main/\_serve/open-courses/ucbcs186_fa2020/01-intro.pdf](https://github.com/YikSanChan/fileserve/blob/main/_serve/open-courses/ucbcs186_fa2020/01-intro.pdf).

![GitHub preview](/images/free-and-simple-directory-listing-with-vercel/github-preview.png)

According to our criteria:

- Free (✅).
- Simple (✅): To developers.
- URL friendly (〰️): Both directories and files are accessible via reasonable URLs. However, the URL includes less useful information such as `/blob/main`, and the domain is not customizable.
- Browsable (〰️): It renders the PDF content in a canvas, which looks ok. However, if the PDF file is too large, it will not render. There is a workaround if you know how to get the raw URL of the PDF file (by digging into the Chrome developer tool and check the networks, in this case, the raw URL is [https://raw.githubusercontent.com/YikSanChan/fileserve/b0ac4f614c39c85b81cb070234565c3ac243abb0/\_serve/open-courses/ucbcs186_fa2020/01-intro.pdf](https://raw.githubusercontent.com/YikSanChan/fileserve/b0ac4f614c39c85b81cb070234565c3ac243abb0/_serve/open-courses/ucbcs186_fa2020/01-intro.pdf)), but that takes extra knowledge and requires a download.

### Self hosting

Host a simple web app that serve static files on a HTTP server that you control. An example can be found at [http://www.mathcs.emory.edu/~cheung/Courses/554/Syllabus/](http://www.mathcs.emory.edu/~cheung/Courses/554/Syllabus/).

![Self-hosting listing](/images/free-and-simple-directory-listing-with-vercel/selfhosting-listing.png)

This approach is straightforward if you know how to run your own HTTP server, but that requires a good amount of knowledge and practice. You may need:

- A host such as an AWS EC2 instance.
- An up-and-running local app that serves static files, such as an [Express.js](https://expressjs.com/en/starter/static-files.html) app or a [SimpleHTTPServer](https://developer.mozilla.org/en-US/docs/Learn/Common_questions/set_up_a_local_testing_server) app.
- A deployment pipeline to push your local change to your host. It can be as simple as [SFTP](https://en.wikipedia.org/wiki/SFTP), or as fancy as [GitHub Action](https://github.com/features/actions).
- A proxy sitting in front of your app. You may also leverage [Nginx Static Content Serving](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/) so that you don't need an app merely for the static files serving purposes.
- A CDN if you want to make it faster.
- A custom domain in case you don't like the original hostname provided by AWS EC2, that nobody does.

According to our criteria:

- Free (❌). AWS EC2 instances and CDNs are not free.
- Simple (❌): Way too complicated even to developers.
- URL friendly (✅): Both directories are accessible via reasonable URLs, and you can customize the domain.
- Browsable (✅): Clicking into the PDF will open a separate tab in your browser.

### Vercel

[Vercel](https://vercel.com) helps you to build [the Next Web](https://vercel.com/blog/series-b-40m-to-build-the-next-web). It allows you to deploy your JS apps to [Vercel's global CDN](https://vercel.com/docs/edge-network/overview) for [free](https://vercel.com/pricing) by simply [pushing to GitHub](https://vercel.com/docs/git/vercel-for-github). An example can be found at [https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020](https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020). As you can see, it is exactly what we're looking for: a directory on the web.

![Vercel listing](/images/free-and-simple-directory-listing-with-vercel/vercel-listing.png)

According to our criteria:

- Free (✅).
- Simple (✅): As long as you know how to push to GitHub.
- URL friendly (✅): Both directories are accessible via reasonable URLs, and you can [customize the domain](https://vercel.com/docs/custom-domains).
- Browsable (✅): Clicking into the PDF will open a separate tab in your browser.

### Comparison

In summary, Vercel wins.

| Solutions            | Free | Simple | URL friendly | Browsable |
| -------------------- | ---- | ------ | ------------ | --------- |
| File storage service | ✅   | ✅     | ❌           | 〰️        |
| Code hosting service | ✅   | ✅     | 〰️           | 〰️        |
| Self hosting         | ❌   | ❌     | ✅           | ✅        |
| Vercel               | ✅   | ✅     | ✅           | ✅        |

I will walk through "how" in the following section.

## Directory listing with Vercel

**Step 1**: In the project root directory, create a directory (I call it `_serve`, you can pick whatever name you like) and put all the files you want to serve in that directory. Also, run `git init` to version control the root directory.

```
|____ .git
|____ _serve
| |____open-courses
| | |____cmu15445_fa2020
| | | |____...
| | |____ucbcs186_fa2020
| | | |____05b-tree-indexes.pdf
| | | |____14-transactions-1.pdf
| | | |____09-sort-hash.pdf
| | | |____20-parallel-1.pdf
| | | |____...
```

**Step 2**: Run locally with `serve` by running `npx serve _serve`. See [vercel/serve](https://github.com/vercel/serve) for more details. Then go to `[localhost:5000](http://localhost:5000)` and you should be able to see:

![Local vercel root](/images/free-and-simple-directory-listing-with-vercel/local-vercel-root.png)

**Step 3**: Run `git push` in the root directory to GitHub, and [connect Vercel with your GitHub project](https://vercel.com/docs/git#deploying-a-git-repository). In my case, my GitHub project is named "fileserve", therefore the Vercel project is also called "fileserve". See the [fileserve GitHub project](https://github.com/YikSanChan/fileserve).

**Step 4**: In Vercel dashboard, click into the fileserve project, go to Settings, and set Root Directory as "\_serve". You need to input the directory name you gave.

![Vercel settings root directory](/images/free-and-simple-directory-listing-with-vercel/vercel-settings-root-directory.png)

**Step 5**: Still in Settings, toggle Directory Listing to "Enabled".

![Vercel settings directory listing](/images/free-and-simple-directory-listing-with-vercel/vercel-settings-directory-listing.png)

**Step 6**: Go to the deployment URL [https://fileserve.yishengdd.vercel.app](https://fileserve.yishengdd.vercel.app) and find the slides as I show in the beginning at [https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020](https://fileserve.yishengdd.vercel.app/open-courses/ucbcs186_fa2020). All set!

## Conclusion

Try [Vercel](https://vercel.com)! It provides a free and simple directory listing solution, that gives you friendly URLs and browsable PDFs!

---
