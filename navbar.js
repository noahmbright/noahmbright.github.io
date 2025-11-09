// FIXME: this only works if all its imported in an html file in the same directory
class NavBar extends HTMLElement{
    constructor(){
        super()
        this.innerHTML = `
        <nav class="navbar">
            <ul>
                <li><a href="/index.html"> Home </a></li>
                <li><a href="/posts/about.html"> About </a></li>
                <li><a href="/posts/applets.html"> Toys </a></li>
            </ul>
        </nav>
        `
    }
}

customElements.define("nav-bar", NavBar)
